import { prisma } from '@/server/db';
import { Prisma, PayrollPeriodStatus } from '@prisma/client';
import { PayrollPeriodFormValues } from '../validators/payroll-periods';

export class PayrollPeriodsService {
  static async getPayrollPeriods(params?: { search?: string }) {
    const where: Prisma.PayrollPeriodWhereInput = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
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

  static async getPayrollPeriodById(id: string) {
    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        payrollRuns: true,
      },
    });

    if (!period) throw new Error('Payroll period not found');
    return period;
  }

  static async createPayrollPeriod(data: PayrollPeriodFormValues) {
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

    return prisma.payrollPeriod.create({
      data: {
        ...data,
      },
    });
  }

  static async updatePayrollPeriod(id: string, data: PayrollPeriodFormValues) {
    const existing = await this.getPayrollPeriodById(id);

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

    return prisma.payrollPeriod.update({
      where: { id },
      data: {
        ...data,
      },
    });
  }

  static async changeStatus(id: string, status: PayrollPeriodStatus, reason?: string) {
    const existing = await this.getPayrollPeriodById(id);

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

    return prisma.payrollPeriod.update({
      where: { id },
      data: { status },
    });
  }
}
