import { prisma } from '@/server/db';
import { Prisma, LoanStatus } from '@prisma/client';
import { LoanFormValues } from '../validators/loans';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

export class LoansService {
  static async getLoans(
    session: AppSession | null,
    params?: { search?: string; type?: string; status?: string },
  ) {
    await authorize(session, 'hr:read');
    const where: Prisma.LoanRequestWhereInput = {};

    if (params?.search) {
      where.OR = [
        { referenceNo: { contains: params.search } },
        { employee: { firstName: { contains: params.search } } },
        { employee: { lastName: { contains: params.search } } },
        { employee: { code: { contains: params.search } } },
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

  static async getLoanById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    return this._getLoanByIdRaw(id);
  }

  private static async _getLoanByIdRaw(id: string) {
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

  static async getDashboardStats(session: AppSession | null) {
    await authorize(session, 'hr:read');
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

  static async createLoan(session: AppSession | null, data: LoanFormValues) {
    const actor = await authorize(session, 'hr:write');
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

    return prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.create({
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

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-loan',
          entityType: 'LoanRequest',
          entityId: loan.id,
          after: { referenceNo: loan.referenceNo, requestType: loan.requestType, loanAmount: loan.loanAmount },
        },
        tx,
      );

      return loan;
    });
  }

  static async updateLoan(session: AppSession | null, id: string, data: LoanFormValues) {
    const actor = await authorize(session, 'hr:write');
    const existing = await this._getLoanByIdRaw(id);

    if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
      throw new Error('Cannot edit a loan request after it has been reviewed.');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.loanRequest.update({
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

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'update-loan',
          entityType: 'LoanRequest',
          entityId: id,
          before: { loanAmount: existing.loanAmount, status: existing.status },
          after: { loanAmount: updated.loanAmount, status: updated.status },
        },
        tx,
      );

      return updated;
    });
  }

  static async processApproval(
    session: AppSession | null,
    id: string,
    newStatus: LoanStatus,
    remarks?: string | null,
  ) {
    const actor = await authorize(session, 'hr:write');
    const existing = await this._getLoanByIdRaw(id);

    const updateData: any = {
      status: newStatus,
    };

    if (remarks) {
      updateData.remarks = remarks;
    }

    // Captured once so the later branches' rejection checks type-check —
    // the first branch already claims every REJECTED transition (matches
    // the reference service's behavior: a rejection always records against
    // `hrApprovalStatus`, whichever stage it happened at).
    const isRejection = (newStatus as LoanStatus) === 'REJECTED';

    if (newStatus === 'PENDING_ACCOUNTS' || isRejection) {
      updateData.hrApprovalStatus = isRejection ? 'Rejected' : 'Approved';
    } else if (newStatus === 'PENDING_MANAGEMENT' || (isRejection && existing.status === 'PENDING_ACCOUNTS')) {
      updateData.accountsVerification = isRejection ? 'Rejected' : 'Verified';
    } else if (newStatus === 'APPROVED' || (isRejection && existing.status === 'PENDING_MANAGEMENT')) {
      updateData.managementDecision = isRejection ? 'Rejected' : 'Approved';
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
        
        let startYear = Number(updatedLoan.repaymentStartMonth.slice(0, 4));
        let startMonth = Number(updatedLoan.repaymentStartMonth.slice(5, 7));
        
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

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'process-loan-approval',
          entityType: 'LoanRequest',
          entityId: id,
          before: { status: existing.status },
          after: { status: updatedLoan.status, remarks },
        },
        tx,
      );

      return updatedLoan;
    });
  }
}
