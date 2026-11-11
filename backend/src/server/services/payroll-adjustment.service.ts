import { prisma } from '@/server/db';
import { Prisma, PayrollAdjustmentStatus } from '@prisma/client';
import { PayrollAdjustmentFormValues } from '../validators/payroll-adjustment';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

export class PayrollAdjustmentService {
  static async getDashboardStats(session: AppSession | null) {
    await authorize(session, 'hr:read');
    const pending = await prisma.payrollAdjustment.count({
      where: { status: { in: ['SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT'] } },
    });

    const approved = await prisma.payrollAdjustment.count({
      where: { status: 'APPROVED' },
    });

    const rejected = await prisma.payrollAdjustment.count({
      where: { status: 'REJECTED' },
    });

    // Total approved adjustments for the current month
    const currentDate = new Date();
    const currentMonthBonuses = await prisma.payrollAdjustment.findMany({
      where: {
        status: { in: ['APPROVED', 'APPLIED', 'COMPLETED'] },
        payrollPeriod: {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear()
        }
      }
    });

    const currentMonthAmount = currentMonthBonuses.reduce((sum, adj) => sum + Number(adj.amount), 0);

    return {
      pending,
      approved,
      rejected,
      currentMonthAmount,
    };
  }

  static async getAdjustments(session: AppSession | null, where?: Prisma.PayrollAdjustmentWhereInput) {
    await authorize(session, 'hr:read');
    return prisma.payrollAdjustment.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, code: true } },
        payrollPeriod: { select: { name: true, month: true, year: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAdjustmentById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    return prisma.payrollAdjustment.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, code: true, basicSalary: true } },
        payrollPeriod: { select: { id: true, name: true, status: true, month: true, year: true } }
      }
    });
  }

  static async createAdjustment(session: AppSession | null, data: PayrollAdjustmentFormValues) {
    const actor = await authorize(session, 'hr:write');
    const { employeeIds, ...adjustmentData } = data;

    return prisma.$transaction(async (tx) => {
      const adjustments = [];

      for (const employeeId of employeeIds) {
        // Prevent duplicate adjustment for same employee, type, and period
        const existing = await tx.payrollAdjustment.findFirst({
          where: {
            employeeId,
            payrollPeriodId: adjustmentData.payrollPeriodId,
            type: adjustmentData.type,
            status: { not: 'REJECTED' }
          }
        });

        if (existing) {
          throw new Error(`An active adjustment of type ${adjustmentData.type} already exists for this employee in the selected payroll period.`);
        }

        const adjustment = await tx.payrollAdjustment.create({
          data: {
            ...adjustmentData,
            employeeId,
            adjustmentDate: new Date(adjustmentData.adjustmentDate),
            no: `ADJ-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
            status: 'DRAFT',
          }
        });

        adjustments.push(adjustment);
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-payroll-adjustment',
          entityType: 'PayrollAdjustment',
          entityId: adjustments[0]?.id ?? null,
          after: { count: adjustments.length, type: adjustmentData.type, payrollPeriodId: adjustmentData.payrollPeriodId },
        },
        tx,
      );

      return adjustments;
    });
  }

  static async updateAdjustment(
    session: AppSession | null,
    id: string,
    data: Omit<PayrollAdjustmentFormValues, 'employeeIds'>,
  ) {
    const actor = await authorize(session, 'hr:write');
    return prisma.$transaction(async (tx) => {
      const existing = await tx.payrollAdjustment.findUnique({ where: { id } });
      const updated = await tx.payrollAdjustment.update({
        where: { id },
        data: {
          ...data,
          adjustmentDate: new Date(data.adjustmentDate),
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'update-payroll-adjustment',
          entityType: 'PayrollAdjustment',
          entityId: id,
          before: { amount: existing?.amount, status: existing?.status },
          after: { amount: updated.amount, status: updated.status },
        },
        tx,
      );

      return updated;
    });
  }

  static async updateStatus(session: AppSession | null, id: string, status: PayrollAdjustmentStatus, remarks?: string) {
    const actor = await authorize(session, 'hr:write');
    const data: Prisma.PayrollAdjustmentUpdateInput = { status };

    if (remarks) {
      if (status === 'APPROVED') {
        data.remarks = remarks;
        data.hrDecision = 'APPROVED';
        data.managementDecision = 'APPROVED';
      } else if (status === 'REJECTED') {
        data.remarks = remarks;
      }
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.payrollAdjustment.findUnique({ where: { id } });
      const updated = await tx.payrollAdjustment.update({
        where: { id },
        data,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'update-payroll-adjustment-status',
          entityType: 'PayrollAdjustment',
          entityId: id,
          before: { status: existing?.status },
          after: { status: updated.status, remarks },
        },
        tx,
      );

      return updated;
    });
  }

  static async deleteAdjustment(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    return prisma.$transaction(async (tx) => {
      const existing = await tx.payrollAdjustment.findUnique({ where: { id } });
      const deleted = await tx.payrollAdjustment.delete({
        where: { id },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'delete-payroll-adjustment',
          entityType: 'PayrollAdjustment',
          entityId: id,
          before: { amount: existing?.amount, status: existing?.status },
        },
        tx,
      );

      return deleted;
    });
  }
}
