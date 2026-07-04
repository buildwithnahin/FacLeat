import { prisma } from '@/server/db';
import { Prisma, PayrollAdjustmentStatus } from '@prisma/client';
import { PayrollAdjustmentFormValues } from '../validators/payroll-adjustment';

export class PayrollAdjustmentService {
  static async getDashboardStats() {
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

  static async getAdjustments(where?: Prisma.PayrollAdjustmentWhereInput) {
    return prisma.payrollAdjustment.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, code: true } },
        payrollPeriod: { select: { name: true, month: true, year: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getAdjustmentById(id: string) {
    return prisma.payrollAdjustment.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, code: true, basicSalary: true } },
        payrollPeriod: { select: { id: true, name: true, status: true, month: true, year: true } }
      }
    });
  }

  static async createAdjustment(data: PayrollAdjustmentFormValues) {
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
      
      return adjustments;
    });
  }

  static async updateAdjustment(id: string, data: Omit<PayrollAdjustmentFormValues, 'employeeIds'>) {
    return prisma.payrollAdjustment.update({
      where: { id },
      data: {
        ...data,
        adjustmentDate: new Date(data.adjustmentDate),
      },
    });
  }

  static async updateStatus(id: string, status: PayrollAdjustmentStatus, remarks?: string) {
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
    
    return prisma.payrollAdjustment.update({
      where: { id },
      data,
    });
  }

  static async deleteAdjustment(id: string) {
    return prisma.payrollAdjustment.delete({
      where: { id },
    });
  }
}
