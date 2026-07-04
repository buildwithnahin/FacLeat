import { prisma } from '@/server/db';
import { Prisma, PayslipStatus, PaymentStatus } from '@prisma/client';

export class PayslipService {
  static async getDashboardStats() {
    const currentPeriod = await prisma.payrollPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startDate: 'desc' }
    });

    const stats = {
      month: currentPeriod ? currentPeriod.name : 'N/A',
      totalPayslips: 0,
      published: 0,
      pending: 0,
      totalPayroll: 0
    };

    if (currentPeriod) {
      const payslips = await prisma.payslip.findMany({
        where: { payrollRun: { payrollPeriodId: currentPeriod.id } }
      });

      stats.totalPayslips = payslips.length;
      
      payslips.forEach(p => {
        if (p.status === 'PUBLISHED') stats.published++;
        else stats.pending++;
        
        stats.totalPayroll += Number(p.net);
      });
    }

    return stats;
  }

  static async getPayslips(where?: Prisma.PayslipWhereInput) {
    return prisma.payslip.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, code: true, designation: true } },
        payrollRun: { select: { period: true, status: true, payrollPeriod: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPayslipById(id: string) {
    return prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            branch: true,
            department: true,
            designation: true,
          }
        },
        payrollRun: {
          include: {
            payrollPeriod: true
          }
        }
      }
    });
  }

  static async updateStatus(id: string, status: PayslipStatus, paymentStatus?: PaymentStatus) {
    const data: Prisma.PayslipUpdateInput = { status };
    if (paymentStatus) {
      data.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID') {
        data.paymentDate = new Date();
        data.transactionRef = `TXN-${Date.now().toString().slice(-6)}`;
      }
    }
    
    return prisma.payslip.update({
      where: { id },
      data
    });
  }

  static async publishAll(payrollRunId: string) {
    return prisma.payslip.updateMany({
      where: { payrollRunId, status: 'GENERATED' },
      data: { status: 'PUBLISHED' }
    });
  }

  static async markAllPaid(payrollRunId: string) {
    return prisma.payslip.updateMany({
      where: { payrollRunId, paymentStatus: 'PENDING' },
      data: { 
        paymentStatus: 'PAID', 
        paymentDate: new Date(),
        transactionRef: `TXN-BULK-${Date.now().toString().slice(-6)}`
      }
    });
  }
}
