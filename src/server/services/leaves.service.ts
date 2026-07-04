import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { leaveBalanceService } from '@/server/services/leave-balance.service';
import { leaveTypesService } from '@/server/services/leave-types.service';
import {
  calculateRequestedLeaveDays,
  resolveLeavePolicyForEmployee,
} from '@/server/services/leave-policies.service';
import type { LeaveApplicationInput, LeaveApprovalInput } from '@/server/validators/leaves';

const LEAVE_INCLUDE = {
  employee: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      department: true,
      designation: true,
      joinedAt: true,
      employmentType: true,
      branchId: true,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
  handoverEmployee: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

type LeaveRecord = Prisma.LeaveRequestGetPayload<{ include: typeof LEAVE_INCLUDE }>;

function normalizeUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function serializeLeaveRecord(record: LeaveRecord) {
  const { employee, days, fromDate, toDate, managerApprovedAt, hrApprovedAt, createdAt, ...rest } = record;
  const { joinedAt, ...employeeRest } = employee;

  return {
    ...rest,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    days: Number(days),
    managerApprovedAt: managerApprovedAt?.toISOString() ?? null,
    hrApprovedAt: hrApprovedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    employee: {
      ...employeeRest,
      joiningDate: joinedAt.toISOString(),
    },
    handoverEmployee: record.handoverEmployee,
  };
}

export const leavesService = {
  async list(
    session: AppSession | null,
    filters: {
      status?: string | string[];
      branchId?: string;
      employeeId?: string;
      department?: string;
      type?: string;
      fromDate?: string | Date;
      toDate?: string | Date;
      q?: string;
    } = {}
  ) {
    await authorize(session, 'hr:read');
    const statusFilter = Array.isArray(filters.status)
      ? filters.status.length > 0
        ? { in: filters.status as any[] }
        : undefined
      : filters.status
        ? (filters.status as any)
        : undefined;

    const records = await prisma.leaveRequest.findMany({
      where: {
        status: statusFilter,
        employeeId: filters.employeeId || undefined,
        type: filters.type || undefined,
        fromDate: filters.fromDate ? { gte: new Date(filters.fromDate) } : undefined,
        toDate: filters.toDate ? { lte: new Date(filters.toDate) } : undefined,
        employee: {
          branchId: filters.branchId || undefined,
          department: filters.department || undefined,
          OR: filters.q
            ? [
                { firstName: { contains: filters.q, mode: 'insensitive' } },
                { lastName: { contains: filters.q, mode: 'insensitive' } },
                { code: { contains: filters.q, mode: 'insensitive' } },
              ]
            : undefined,
        },
      },
      include: LEAVE_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
    return records.map(serializeLeaveRecord);
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const record = await prisma.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_INCLUDE,
    });
    if (!record) throw new NotFoundError('Leave request not found');
    return serializeLeaveRecord(record);
  },

  async getLeaveBalance(session: AppSession | null, employeeId: string, year: number) {
    await authorize(session, 'hr:read');
    return leaveBalanceService.getBalancePreview(session, employeeId, year);
  },

  async apply(session: AppSession | null, input: LeaveApplicationInput) {
    const actor = await authorize(session, 'hr:write');
    await leaveTypesService.assertCodeExists(input.type);
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true, branchId: true, employmentType: true, joinedAt: true },
    });
    if (!employee) throw new NotFoundError('Employee not found');
    const policy = await resolveLeavePolicyForEmployee(input.employeeId, new Date(input.fromDate));
    const rule = policy.rules.find((item) => item.leaveType === input.type && item.status === 'ACTIVE');
    if (!rule) {
      throw new ValidationError(`No active leave rule is configured for ${input.type.replaceAll('_', ' ')}.`);
    }

    const fromDate = new Date(input.fromDate);
    const toDate = new Date(input.toDate);

    // Check duplicate dates
    const duplicate = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: input.employeeId,
        status: { notIn: ['CANCELLED', 'REJECTED', 'WITHDRAWN'] },
        OR: [
          {
            fromDate: { lte: toDate },
            toDate: { gte: fromDate },
          },
        ],
      },
    });
    if (duplicate) {
      throw new ValidationError(`Employee already has a leave request (${duplicate.leaveRequestNo}) in this date range.`);
    }

    // Days calculation
    let days = 0;
    if (input.halfDay) {
      if (!rule.halfDayAllowed) {
        throw new ValidationError('Half day is not allowed for this leave type.');
      }
      days = 0.5;
    } else {
      days = await calculateRequestedLeaveDays(input.employeeId, fromDate, toDate, rule);
      if (days <= 0) {
        throw new ValidationError('The requested range has no chargeable working days (weekly offs/holidays only).');
      }
    }

    if (rule.attachmentRequired && !input.attachmentPath) {
      throw new ValidationError('Attachment is required for this leave type.');
    }
    if (rule.reasonRequired && !input.reason.trim()) {
      throw new ValidationError('Reason is required for this leave type.');
    }
    if (!policy.allowProbationEmployees && employee.employmentType === 'PROBATION') {
      throw new ValidationError('This policy does not allow probation employee leave applications.');
    }
    const serviceMonths =
      (normalizeUtcDate(fromDate).getTime() - normalizeUtcDate(employee.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (rule.minimumServiceMonths != null && serviceMonths < rule.minimumServiceMonths) {
      throw new ValidationError(`This leave type requires at least ${rule.minimumServiceMonths} months of service.`);
    }
    if (rule.maxLeavePerRequest != null && days > rule.maxLeavePerRequest) {
      throw new ValidationError(`This leave type allows at most ${rule.maxLeavePerRequest} days per request.`);
    }

    const monthStart = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    if (rule.maxLeavePerMonth != null) {
      const monthlyRequested = await prisma.leaveRequest.findMany({
        where: {
          employeeId: input.employeeId,
          type: input.type,
          status: { notIn: ['CANCELLED', 'REJECTED', 'WITHDRAWN'] },
          fromDate: { lte: monthEnd },
          toDate: { gte: monthStart },
        },
        select: { days: true },
      });
      const requestedThisMonth = monthlyRequested.reduce((sum, request) => sum + Number(request.days), 0);
      if (requestedThisMonth + days > rule.maxLeavePerMonth) {
        throw new ValidationError(`This leave type allows at most ${rule.maxLeavePerMonth} days per month.`);
      }
    }

    // Check balance
    const currentYear = fromDate.getUTCFullYear();
    const balance = await this.getLeaveBalance(session, input.employeeId, currentYear);
    const typeBalance = balance[input.type];
    
    // Skip balance checks for UNPAID leave types or if type is not strictly limited
    if (!rule.allowNegativeBalance && !rule.isUnlimited && typeBalance && !typeBalance.isUnlimited && typeBalance.available < days) {
      throw new ValidationError(
        `Insufficient leave balance. Entitled: ${typeBalance.entitled}, Carry Forward: ${typeBalance.carryForward}, Used: ${typeBalance.used}, Pending: ${typeBalance.pending}, Available: ${typeBalance.available}, Requested: ${days}`
      );
    }

    // Generate Request No (e.g. LR-202607-0001)
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const count = await prisma.leaveRequest.count({
      where: { leaveRequestNo: { startsWith: `LR-${dateStr}-` } },
    });
    const serial = String(count + 1).padStart(4, '0');
    const leaveRequestNo = `LR-${dateStr}-${serial}`;

    let initialStatus: 'APPROVED' | 'PENDING_MANAGER' | 'PENDING_HR' = 'PENDING_MANAGER';
    if (!policy.approvalRequired || policy.autoApproveAllowed) {
      initialStatus = 'APPROVED';
    } else if (!policy.managerApprovalRequired && policy.hrApprovalRequired) {
      initialStatus = 'PENDING_HR';
    } else if (!policy.managerApprovalRequired && !policy.hrApprovalRequired) {
      initialStatus = 'APPROVED';
    }

    return prisma.$transaction(async (tx) => {
      const lr = await tx.leaveRequest.create({
        data: {
          leaveRequestNo,
          employeeId: input.employeeId,
          type: input.type,
          fromDate,
          toDate,
          days: new Prisma.Decimal(days),
          halfDay: input.halfDay,
          halfDayType: input.halfDay ? input.halfDayType : null,
          reason: input.reason,
          attachmentPath: input.attachmentPath,
          emergencyContact: input.emergencyContact,
          handoverEmployeeId: input.handoverEmployeeId,
          status: initialStatus,
          managerStatus: initialStatus === 'PENDING_HR' || initialStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
          managerId: initialStatus === 'PENDING_HR' || initialStatus === 'APPROVED' ? actor.userId : null,
          managerApprovedAt: initialStatus === 'PENDING_HR' || initialStatus === 'APPROVED' ? new Date() : null,
          hrStatus: initialStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
          hrId: initialStatus === 'APPROVED' ? actor.userId : null,
          hrApprovedAt: initialStatus === 'APPROVED' ? new Date() : null,
          createdById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: employee.branchId,
          module: 'hr',
          action: 'leave-apply',
          entityType: 'LeaveRequest',
          entityId: lr.id,
          after: { leaveRequestNo, days, status: lr.status, policyCode: policy.policyCode, leaveType: input.type },
        },
        tx
      );

      return lr;
    });
  },

  async decide(session: AppSession | null, input: LeaveApprovalInput) {
    const actor = await authorize(session, input.stage === 'manager' ? 'hr:write' : 'hr:leave-approve');
    const record = await prisma.leaveRequest.findUnique({
      where: { id: input.id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundError('Leave request not found');

    return prisma.$transaction(async (tx) => {
      let statusUpdate: any = {};
      let actionName = 'leave-decide';

      if (input.stage === 'manager') {
        if (record.status !== 'PENDING_MANAGER') {
          throw new ValidationError('Request is not in Pending Manager stage.');
        }

        if (input.action === 'approve') {
          statusUpdate = {
            status: 'PENDING_HR',
            managerStatus: 'APPROVED',
            managerRemarks: input.remarks,
            managerId: actor.userId,
            managerApprovedAt: new Date(),
          };
          actionName = 'leave-manager-approve';
        } else if (input.action === 'reject') {
          statusUpdate = {
            status: 'REJECTED',
            managerStatus: 'REJECTED',
            managerRemarks: input.remarks,
            managerId: actor.userId,
            managerApprovedAt: new Date(),
          };
          actionName = 'leave-manager-reject';
        } else if (input.action === 'return') {
          statusUpdate = {
            status: 'RETURNED',
            managerStatus: 'RETURNED',
            managerRemarks: input.remarks,
            managerId: actor.userId,
            managerApprovedAt: new Date(),
          };
          actionName = 'leave-manager-return';
        }
      } else if (input.stage === 'hr') {
        if (record.status !== 'PENDING_HR') {
          throw new ValidationError('Request is not in Pending HR stage.');
        }

        if (input.action === 'approve') {
          statusUpdate = {
            status: 'APPROVED',
            hrStatus: 'APPROVED',
            hrRemarks: input.remarks,
            hrId: actor.userId,
            hrApprovedAt: new Date(),
          };
          actionName = 'leave-hr-approve';
        } else if (input.action === 'reject') {
          statusUpdate = {
            status: 'REJECTED',
            hrStatus: 'REJECTED',
            hrRemarks: input.remarks,
            hrId: actor.userId,
            hrApprovedAt: new Date(),
          };
          actionName = 'leave-hr-reject';
        } else if (input.action === 'return') {
          statusUpdate = {
            status: 'RETURNED',
            hrStatus: 'RETURNED',
            hrRemarks: input.remarks,
            hrId: actor.userId,
            hrApprovedAt: new Date(),
          };
          actionName = 'leave-hr-return';
        } else if (input.action === 'cancel') {
          statusUpdate = {
            status: 'CANCELLED',
            hrRemarks: input.remarks,
            hrId: actor.userId,
          };
          actionName = 'leave-hr-cancel';
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id: input.id },
        data: { ...statusUpdate, updatedAt: new Date() },
      });

      // Audit log
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: record.employee.branchId,
          module: 'hr',
          action: actionName,
          entityType: 'LeaveRequest',
          entityId: record.id,
          before: { status: record.status },
          after: { status: updated.status },
        },
        tx
      );

      // If approved, update attendance status
      if (updated.status === 'APPROVED') {
        const cursor = new Date(record.fromDate);
        const end = new Date(record.toDate);
        
        while (cursor <= end) {
          const attendanceStatus = record.halfDay ? 'HALF_DAY' : 'ON_LEAVE';
          await tx.attendanceRecord.upsert({
            where: {
              employeeId_date: {
                employeeId: record.employeeId,
                date: new Date(cursor),
              },
            },
            create: {
              employeeId: record.employeeId,
              date: new Date(cursor),
              status: attendanceStatus,
              remarks: `Leave Approved (${record.leaveRequestNo})`,
              createdById: actor.userId,
            },
            update: {
              status: attendanceStatus,
              remarks: `Leave Approved (${record.leaveRequestNo})`,
            },
          });
          
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }

      const user = await tx.user.findUnique({ where: { employeeId: record.employeeId } });
      if (user) {
        await tx.notification.create({
          data: {
            recipientId: user.id,
            branchId: record.employee.branchId,
            module: 'hr',
            title: `Leave Request ${updated.status}`,
            body: `Your leave request ${record.leaveRequestNo} has been ${updated.status.toLowerCase()}.`,
            href: `/hr/leaves`,
          },
        });
      }

      return updated;
    });
  },

  async bulkDecide(session: AppSession | null, input: { ids: string[]; stage: 'manager' | 'hr'; action: 'approve' | 'reject' | 'return' | 'cancel'; remarks?: string | null }) {
    const results = [];
    for (const id of input.ids) {
      try {
        const result = await this.decide(session, { id, stage: input.stage, action: input.action, remarks: input.remarks });
        results.push({ id, success: true, result });
      } catch (error: any) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  },

  async withdraw(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    const record = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundError('Leave request not found');

    if (!['PENDING_MANAGER', 'PENDING_HR', 'DRAFT', 'RETURNED'].includes(record.status)) {
      throw new ValidationError('Only pending, returned, or draft leave requests can be withdrawn.');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: { status: 'WITHDRAWN' },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: record.employee.branchId,
          module: 'hr',
          action: 'leave-withdraw',
          entityType: 'LeaveRequest',
          entityId: record.id,
          before: { status: record.status },
          after: { status: 'WITHDRAWN' },
        },
        tx
      );

      return updated;
    });
  },
};
