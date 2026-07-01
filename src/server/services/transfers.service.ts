import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { approvalService } from '@/server/services/approval.service';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  TransferCreateInput,
  TransferUpdateInput,
  TransferStatusActionInput,
} from '@/server/validators/transfers';

const TRANSFER_APPROVAL_MODULE = 'hr';
const TRANSFER_APPROVAL_ACTION = 'employee-transfer';
const TRANSFER_APPROVAL_ENTITY = 'EmployeeTransfer';

/** Generate a sequential transfer number like TRF-0001 */
async function nextTransferNumber(): Promise<string> {
  const last = await prisma.employeeTransfer.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { transferNumber: true },
  });
  const seq = last ? parseInt(last.transferNumber.replace('TRF-', ''), 10) + 1 : 1;
  return `TRF-${String(seq).padStart(4, '0')}`;
}

const transferIncludes = {
  employee: { select: { id: true, code: true, firstName: true, lastName: true, department: true, designation: true, branchId: true } },
  branch: { select: { id: true, code: true, name: true } },
  newBranch: { select: { id: true, code: true, name: true } },
  tempBranch: { select: { id: true, code: true, name: true } },
  currentShift: { select: { id: true, name: true, code: true } },
  newShift: { select: { id: true, name: true, code: true } },
  tempShift: { select: { id: true, name: true, code: true } },
  newReportingManager: { select: { id: true, code: true, firstName: true, lastName: true } },
} as const;

async function findLatestTransferApprovalRequest(transferId: string) {
  return prisma.approvalRequest.findFirst({
    where: {
      module: TRANSFER_APPROVAL_MODULE,
      action: TRANSFER_APPROVAL_ACTION,
      entityType: TRANSFER_APPROVAL_ENTITY,
      entityId: transferId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export const transfersService = {
  async list(
    session: AppSession | null,
    filters: {
      branchId?: string;
      employeeId?: string;
      transferType?: string;
      status?: string;
      q?: string;
    } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.employeeTransfer.findMany({
      where: {
        branchId: filters.branchId,
        employeeId: filters.employeeId,
        transferType: filters.transferType as never,
        status: filters.status as never,
        OR: filters.q
          ? [
              { transferNumber: { contains: filters.q, mode: 'insensitive' } },
              { employee: { firstName: { contains: filters.q, mode: 'insensitive' } } },
              { employee: { lastName: { contains: filters.q, mode: 'insensitive' } } },
              { employee: { code: { contains: filters.q, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: transferIncludes,
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const transfer = await prisma.employeeTransfer.findUnique({
      where: { id },
      include: transferIncludes,
    });
    if (!transfer) throw new NotFoundError('Transfer not found');
    return transfer;
  },

  async create(session: AppSession | null, input: TransferCreateInput) {
    const actor = await authorize(session, 'hr:write');

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, shift: true },
    });
    if (!employee) throw new ValidationError('Employee not found');

    // Prevent self-to-same transfers
    if (input.transferType === 'BRANCH' && input.newBranchId === employee.branchId) {
      throw new ValidationError('Employee is already assigned to this branch');
    }
    if (input.transferType === 'DEPARTMENT' && input.newDepartment === employee.department) {
      throw new ValidationError('Employee is already in this department');
    }
    if (input.transferType === 'SHIFT' && input.newShiftId === employee.shiftId) {
      throw new ValidationError('Employee is already assigned to this shift');
    }

    const transferNumber = await nextTransferNumber();

    return prisma.$transaction(async (tx) => {
      const transfer = await tx.employeeTransfer.create({
        data: {
          transferNumber,
          branchId: input.branchId,
          employeeId: input.employeeId,
          transferType: input.transferType,
          status: 'DRAFT',

          // Snapshot current state
          currentBranch: employee.branch.name,
          currentDepartment: employee.department ?? null,
          currentDesignation: employee.designation ?? null,
          currentShiftId: employee.shiftId ?? null,

          // Branch transfer
          newBranchId: input.newBranchId || null,

          // Department transfer
          newDepartment: input.newDepartment || null,

          // Shift transfer
          newShiftId: input.newShiftId || null,

          // Temporary transfer
          tempBranchId: input.tempBranchId || null,
          tempDepartment: input.tempDepartment || null,
          tempShiftId: input.tempShiftId || null,
          startDate: input.startDate instanceof Date ? input.startDate : null,
          endDate: input.endDate instanceof Date ? input.endDate : null,

          // Common
          effectiveDate: input.effectiveDate instanceof Date ? input.effectiveDate : null,
          reason: input.reason,
          newReportingManagerId: input.newReportingManagerId || null,
          remarks: input.remarks || null,

          createdById: actor.userId,
          updatedById: actor.userId,
        },
        include: transferIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'hr',
          action: 'create-transfer',
          entityType: 'EmployeeTransfer',
          entityId: transfer.id,
          after: {
            transferNumber: transfer.transferNumber,
            transferType: transfer.transferType,
            employeeCode: employee.code,
            employeeName: `${employee.firstName} ${employee.lastName}`,
          },
        },
        tx,
      );
      return transfer;
    });
  },

  async update(session: AppSession | null, input: TransferUpdateInput) {
    const actor = await authorize(session, 'hr:write');

    const existing = await prisma.employeeTransfer.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Transfer not found');
    if (existing.status !== 'DRAFT') {
      throw new ValidationError('Only draft transfers can be edited');
    }

    return prisma.$transaction(async (tx) => {
      const transfer = await tx.employeeTransfer.update({
        where: { id: input.id },
        data: {
          transferType: input.transferType,
          newBranchId: input.newBranchId || null,
          newDepartment: input.newDepartment || null,
          newShiftId: input.newShiftId || null,
          tempBranchId: input.tempBranchId || null,
          tempDepartment: input.tempDepartment || null,
          tempShiftId: input.tempShiftId || null,
          startDate: input.startDate instanceof Date ? input.startDate : null,
          endDate: input.endDate instanceof Date ? input.endDate : null,
          effectiveDate: input.effectiveDate instanceof Date ? input.effectiveDate : null,
          reason: input.reason,
          newReportingManagerId: input.newReportingManagerId || null,
          remarks: input.remarks || null,
          updatedById: actor.userId,
        },
        include: transferIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: transfer.branchId,
          module: 'hr',
          action: 'update-transfer',
          entityType: 'EmployeeTransfer',
          entityId: transfer.id,
          before: {
            transferType: existing.transferType,
            status: existing.status,
          },
          after: {
            transferType: transfer.transferType,
            status: transfer.status,
          },
        },
        tx,
      );

      return transfer;
    });
  },

  async changeStatus(session: AppSession | null, input: TransferStatusActionInput) {
    const actor = await authorize(session, 'hr:write');
    const transfer = await prisma.employeeTransfer.findUnique({
      where: { id: input.id },
      include: { employee: true },
    });
    if (!transfer) throw new NotFoundError('Transfer not found');
    const approvalRequest = await findLatestTransferApprovalRequest(transfer.id);

    const validTransitions: Record<string, string[]> = {
      submit: ['DRAFT'],
      approve: ['SUBMITTED'],
      reject: ['SUBMITTED'],
      complete: ['APPROVED'],
      cancel: ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'],
    };

    const allowed = validTransitions[input.action];
    if (!allowed || !allowed.includes(transfer.status)) {
      throw new ValidationError(
        `Cannot ${input.action} a transfer in ${transfer.status} status`,
      );
    }
    if (
      (input.action === 'approve' || input.action === 'reject') &&
      approvalRequest &&
      approvalRequest.status !== 'CANCELLED'
    ) {
      throw new ValidationError(
        'This transfer is using the approval workflow. Approve or reject it from the approvals queue.',
      );
    }

    return prisma.$transaction(async (tx) => {
      const statusMap: Record<string, string> = {
        submit: 'SUBMITTED',
        approve: 'APPROVED',
        reject: 'REJECTED',
        complete: 'COMPLETED',
        cancel: 'CANCELLED',
      };

      const newStatus = statusMap[input.action]!;
      const now = new Date();

      const updateData: Prisma.EmployeeTransferUpdateInput = {
        status: newStatus as never,
        updatedById: actor.userId,
      };

      if (input.action === 'submit') {
        updateData.submittedAt = now;
        updateData.submittedById = actor.userId;
        updateData.status = 'SUBMITTED' as never;
      } else if (input.action === 'approve') {
        updateData.approvedAt = now;
        updateData.approvedById = actor.userId;
      } else if (input.action === 'reject') {
        updateData.rejectedAt = now;
        updateData.rejectedById = actor.userId;
        updateData.rejectionReason = input.rejectionReason || null;
      } else if (input.action === 'cancel' && approvalRequest) {
        await tx.approvalRequest.updateMany({
          where: {
            id: approvalRequest.id,
            status: { in: ['PENDING', 'CHANGES_REQUESTED', 'ESCALATED'] },
          },
          data: {
            status: 'CANCELLED',
            decidedAt: now,
            note: input.rejectionReason || 'Transfer cancelled',
          },
        });
      } else if (input.action === 'complete') {
        updateData.completedAt = now;
        updateData.completedById = actor.userId;

        // Apply the transfer to the employee record
        const empUpdate: Prisma.EmployeeUpdateInput = {};
        if (transfer.transferType === 'BRANCH' && transfer.newBranchId) {
          empUpdate.branch = { connect: { id: transfer.newBranchId } };
        }
        if (transfer.transferType === 'DEPARTMENT' && transfer.newDepartment) {
          empUpdate.department = transfer.newDepartment;
        }
        if (transfer.transferType === 'SHIFT' && transfer.newShiftId) {
          empUpdate.shift = { connect: { id: transfer.newShiftId } };
        }
        if (transfer.transferType === 'PERMANENT') {
          if (transfer.newBranchId) empUpdate.branch = { connect: { id: transfer.newBranchId } };
          if (transfer.newDepartment) empUpdate.department = transfer.newDepartment;
          if (transfer.newShiftId) empUpdate.shift = { connect: { id: transfer.newShiftId } };
        }
        if (transfer.transferType === 'TEMPORARY') {
          if (transfer.tempBranchId) empUpdate.branch = { connect: { id: transfer.tempBranchId } };
          if (transfer.tempDepartment) empUpdate.department = transfer.tempDepartment;
          if (transfer.tempShiftId) empUpdate.shift = { connect: { id: transfer.tempShiftId } };
        }
        if (transfer.newReportingManagerId) {
          empUpdate.reportingManager = { connect: { id: transfer.newReportingManagerId } };
        }

        if (Object.keys(empUpdate).length > 0) {
          await tx.employee.update({
            where: { id: transfer.employeeId },
            data: empUpdate,
          });
        }
      }

      const updated = await tx.employeeTransfer.update({
        where: { id: input.id },
        data: updateData,
        include: transferIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: transfer.branchId,
          module: 'hr',
          action: `transfer-${input.action}`,
          entityType: 'EmployeeTransfer',
          entityId: transfer.id,
          before: { status: transfer.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });

    if (input.action === 'submit') {
      const request = await approvalService.requestIfNeeded(session, {
        module: TRANSFER_APPROVAL_MODULE,
        action: TRANSFER_APPROVAL_ACTION,
        entityType: TRANSFER_APPROVAL_ENTITY,
        entityId: transfer.id,
        title: `Transfer ${transfer.transferNumber}`,
        summary: `${transfer.employee.firstName} ${transfer.employee.lastName} · ${transfer.transferType.toLowerCase()} transfer`,
        branchId: transfer.branchId,
      });

      if (request) {
        return prisma.employeeTransfer.update({
          where: { id: transfer.id },
          data: { status: 'PENDING_APPROVAL' },
          include: transferIncludes,
        });
      }
    }

    return updated;
  },

  /** Count transfers by status for dashboard KPI cards */
  async countByStatus(session: AppSession | null, branchId?: string) {
    await authorize(session, 'hr:read');
    const counts = await prisma.employeeTransfer.groupBy({
      by: ['status'],
      where: branchId ? { branchId } : undefined,
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const c of counts) result[c.status] = c._count;
    return result;
  },
};
