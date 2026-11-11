import { prisma } from '@/server/db';
import { Prisma, PayrollPeriodStatus } from '@prisma/client';
import { PayrollPeriodFormValues } from '../validators/payroll-periods';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

export class PayrollPeriodsService {
  static async getPayrollPeriods(session: AppSession | null, params?: { search?: string }) {
    await authorize(session, 'hr:read');
    const where: Prisma.PayrollPeriodWhereInput = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { code: { contains: params.search } },
      ];
    }

    return prisma.payrollPeriod.findMany({
      where,
      include: {
        payrollRuns: {
          select: { status: true },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });
  }

  static async getPayrollPeriodById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    return this._getByIdRaw(id);
  }

  private static async _getByIdRaw(id: string) {
    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        payrollRuns: true,
      },
    });

    if (!period) throw new Error('Payroll period not found');
    return period;
  }

  static async createPayrollPeriod(session: AppSession | null, data: PayrollPeriodFormValues) {
    const actor = await authorize(session, 'hr:write');
    // Check if month/year already exists
    const existing = await prisma.payrollPeriod.findUnique({
      where: { month_year: { month: data.month, year: data.year } },
    });

    if (existing) {
      throw new Error(`A payroll period for ${data.month}/${data.year} already exists.`);
    }

    if (data.status === 'OPEN') {
      const currentOpen = await prisma.payrollPeriod.findFirst({
        where: { status: 'OPEN' },
      });
      if (currentOpen) {
        throw new Error('Only one payroll period can be open at a time. Please close the existing open period.');
      }
    }

    return prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.create({
        data: {
          ...data,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-payroll-period',
          entityType: 'PayrollPeriod',
          entityId: period.id,
          after: { name: period.name, month: period.month, year: period.year, status: period.status },
        },
        tx,
      );

      return period;
    });
  }

  static async updatePayrollPeriod(session: AppSession | null, id: string, data: PayrollPeriodFormValues) {
    const actor = await authorize(session, 'hr:write');
    const existing = await this._getByIdRaw(id);

    if (existing.status === 'CLOSED') {
      throw new Error('Cannot edit a closed payroll period.');
    }

    if (data.status === 'OPEN' && existing.status !== 'OPEN') {
      const currentOpen = await prisma.payrollPeriod.findFirst({
        where: { status: 'OPEN', id: { not: id } },
      });
      if (currentOpen) {
        throw new Error('Only one payroll period can be open at a time. Please close the existing open period.');
      }
    }

    return prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.update({
        where: { id },
        data: {
          ...data,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'update-payroll-period',
          entityType: 'PayrollPeriod',
          entityId: id,
          before: { status: existing.status },
          after: { status: period.status },
        },
        tx,
      );

      return period;
    });
  }

  static async changeStatus(session: AppSession | null, id: string, status: PayrollPeriodStatus, reason?: string) {
    const actor = await authorize(session, 'hr:lock-payroll');
    const existing = await this._getByIdRaw(id);

    if (status === 'OPEN') {
      const currentOpen = await prisma.payrollPeriod.findFirst({
        where: { status: 'OPEN', id: { not: id } },
      });
      if (currentOpen) {
        throw new Error('Only one payroll period can be open at a time.');
      }
    }

    if (status === 'OPEN' && existing.status === 'CLOSED' && !reason) {
      throw new Error('A reason is required to reopen a closed payroll period.');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payrollPeriod.update({
        where: { id },
        data: { status },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'change-payroll-period-status',
          entityType: 'PayrollPeriod',
          entityId: id,
          before: { status: existing.status },
          after: { status: updated.status, reason },
        },
        tx,
      );

      return updated;
    });
  }
}
