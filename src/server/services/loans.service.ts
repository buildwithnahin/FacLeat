import { prisma } from '@/server/db';
import { Prisma, LoanStatus } from '@prisma/client';
import { LoanFormValues } from '../validators/loans';
import { getSession } from '../auth/session';

export class LoansService {
  static async getLoans(params?: { search?: string; type?: string; status?: string }) {
    const where: Prisma.LoanRequestWhereInput = {};

    if (params?.search) {
      where.OR = [
        { referenceNo: { contains: params.search, mode: 'insensitive' } },
        { employee: { firstName: { contains: params.search, mode: 'insensitive' } } },
        { employee: { lastName: { contains: params.search, mode: 'insensitive' } } },
        { employee: { code: { contains: params.search, mode: 'insensitive' } } },
      ];
    }
    
    if (params?.type) {
      where.requestType = params.type as any;
    }
    if (params?.status) {
      where.status = params.status as any;
    }

    return prisma.loanRequest.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, code: true },
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getLoanById(id: string) {
    const loan = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            code: true, 
            department: true,
            designation: true,
            joinedAt: true,
            employmentType: true,
            basicSalary: true,
            houseAllowance: true,
          }
        },
        repaymentSchedules: {
          orderBy: { payrollMonth: 'asc' },
        }
      },
    });

    if (!loan) throw new Error('Loan request not found');
    return loan;
  }

  static async getDashboardStats() {
    const stats = await prisma.loanRequest.groupBy({
      by: ['status', 'requestType'],
      _count: { id: true },
      _sum: {
        loanAmount: true,
        outstandingBalance: true,
        monthlyDeduction: true,
      },
    });

    const pendingRequests = stats.filter(s => ['SUBMITTED', 'PENDING_HR', 'PENDING_ACCOUNTS', 'PENDING_MANAGEMENT'].includes(s.status)).reduce((acc, curr) => acc + curr._count.id, 0);
    const activeLoans = stats.filter(s => s.status === 'ACTIVE' && s.requestType === 'EMPLOYEE_LOAN').reduce((acc, curr) => acc + curr._count.id, 0);
    const salaryAdvances = stats.filter(s => s.status === 'ACTIVE' && s.requestType === 'SALARY_ADVANCE').reduce((acc, curr) => acc + curr._count.id, 0);
    
    const monthlyDeduction = stats.filter(s => s.status === 'ACTIVE').reduce((acc, curr) => acc + Number(curr._sum.monthlyDeduction || 0), 0);
    const outstandingBalance = stats.filter(s => s.status === 'ACTIVE' || s.status === 'DISBURSED').reduce((acc, curr) => acc + Number(curr._sum.outstandingBalance || 0), 0);

    return {
      pendingRequests,
      activeLoans,
      salaryAdvances,
      monthlyDeduction,
      outstandingBalance,
    };
  }

  static async createLoan(data: LoanFormValues) {
    const prefix = data.requestType === 'SALARY_ADVANCE' ? 'AD' : 'LN';
    const count = await prisma.loanRequest.count({ where: { requestType: data.requestType } });
    const referenceNo = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    // Prevent multiple pending requests for same type
    const existingPending = await prisma.loanRequest.findFirst({
      where: {
        employeeId: data.employeeId,
        requestType: data.requestType,
        status: { in: ['DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_ACCOUNTS', 'PENDING_MANAGEMENT'] }
      }
    });

    if (existingPending) {
      throw new Error(`Employee already has a pending ${data.requestType.replace('_', ' ')} request.`);
    }

    return prisma.loanRequest.create({
      data: {
        referenceNo,
        requestType: data.requestType,
        employeeId: data.employeeId,
        loanAmount: new Prisma.Decimal(data.loanAmount),
        purpose: data.purpose,
        disbursementDate: data.disbursementDate,
        repaymentStartMonth: data.repaymentStartMonth,
        installmentType: data.installmentType,
        numberOfInstallments: data.numberOfInstallments,
        monthlyDeduction: new Prisma.Decimal(data.monthlyDeduction),
        outstandingBalance: new Prisma.Decimal(data.loanAmount),
        remarks: data.remarks,
        status: data.status,
      },
    });
  }

  static async updateLoan(id: string, data: LoanFormValues) {
    const existing = await this.getLoanById(id);

    if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
      throw new Error('Cannot edit a loan request after it has been reviewed.');
    }

    return prisma.loanRequest.update({
      where: { id },
      data: {
        requestType: data.requestType,
        employeeId: data.employeeId,
        loanAmount: new Prisma.Decimal(data.loanAmount),
        purpose: data.purpose,
        disbursementDate: data.disbursementDate,
        repaymentStartMonth: data.repaymentStartMonth,
        installmentType: data.installmentType,
        numberOfInstallments: data.numberOfInstallments,
        monthlyDeduction: new Prisma.Decimal(data.monthlyDeduction),
        outstandingBalance: new Prisma.Decimal(data.loanAmount),
        remarks: data.remarks,
        status: data.status,
      },
    });
  }

  static async processApproval(id: string, newStatus: LoanStatus, remarks?: string | null) {
    const session = await getSession();
    const existing = await this.getLoanById(id);

    const updateData: any = {
      status: newStatus,
    };

    if (remarks) {
      updateData.remarks = remarks;
    }

    if (newStatus === 'PENDING_ACCOUNTS' || newStatus === 'REJECTED') {
      updateData.hrApprovalStatus = newStatus === 'REJECTED' ? 'Rejected' : 'Approved';
    } else if (newStatus === 'PENDING_MANAGEMENT' || (newStatus === 'REJECTED' && existing.status === 'PENDING_ACCOUNTS')) {
      updateData.accountsVerification = newStatus === 'REJECTED' ? 'Rejected' : 'Verified';
    } else if (newStatus === 'APPROVED' || (newStatus === 'REJECTED' && existing.status === 'PENDING_MANAGEMENT')) {
      updateData.managementDecision = newStatus === 'REJECTED' ? 'Rejected' : 'Approved';
    }

    // Auto-generate repayment schedule if changing to DISBURSED or ACTIVE
    return prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.loanRequest.update({
        where: { id },
        data: updateData,
      });

      if ((newStatus === 'DISBURSED' || newStatus === 'ACTIVE') && existing.repaymentSchedules.length === 0) {
        // Generate Schedule
        let currentBalance = Number(updatedLoan.loanAmount);
        const deduction = Number(updatedLoan.monthlyDeduction);
        
        let startYear = parseInt(updatedLoan.repaymentStartMonth.split('-')[0]);
        let startMonth = parseInt(updatedLoan.repaymentStartMonth.split('-')[1]);
        
        const schedules = [];
        
        for (let i = 0; i < updatedLoan.numberOfInstallments; i++) {
          const installment = Math.min(currentBalance, deduction);
          currentBalance -= installment;
          
          const monthStr = `${startYear}-${String(startMonth).padStart(2, '0')}`;
          
          schedules.push({
            loanRequestId: id,
            payrollMonth: monthStr,
            installment: new Prisma.Decimal(installment),
            remainingBalance: new Prisma.Decimal(currentBalance),
          });

          // increment month
          startMonth++;
          if (startMonth > 12) {
            startMonth = 1;
            startYear++;
          }
        }

        await tx.loanRepaymentSchedule.createMany({
          data: schedules,
        });
      }

      return updatedLoan;
    });
  }
}
