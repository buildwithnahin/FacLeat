import { prisma } from '@/server/db';
import { Prisma, FinalSettlementStatus } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

export class FinalSettlementService {
  static async getDashboardStats(session: AppSession | null) {
    await authorize(session, 'hr:read');
    const stats = {
      pending: 0,
      approved: 0,
      paid: 0,
      totalAmount: 0,
    };

    const settlements = await prisma.finalSettlement.findMany({
      select: { status: true, netSettlement: true }
    });

    settlements.forEach(s => {
      if (['DRAFT', 'CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(s.status)) {
        stats.pending++;
      } else if (s.status === 'APPROVED') {
        stats.approved++;
      } else if (s.status === 'PAID' || s.status === 'CLOSED') {
        stats.paid++;
      }

      if (['APPROVED', 'PAID', 'CLOSED'].includes(s.status)) {
        stats.totalAmount += Number(s.netSettlement);
      }
    });

    return stats;
  }

  static async getSettlements(session: AppSession | null, where?: Prisma.FinalSettlementWhereInput) {
    await authorize(session, 'hr:read');
    return prisma.finalSettlement.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, code: true, department: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getSettlementById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    return prisma.finalSettlement.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            branch: true
          }
        },
        resignation: {
          include: {
            exitClearance: true
          }
        }
      }
    });
  }

  static async calculateSettlement(session: AppSession | null, resignationId: string) {
    const actor = await authorize(session, 'hr:write');
    return prisma.$transaction(async (tx) => {
      const resignation = await tx.employeeResignation.findUnique({
        where: { id: resignationId },
        include: {
          employee: {
            include: {
              loans: {
                where: { status: 'ACTIVE' },
                include: {
                  repaymentSchedules: { where: { status: 'PENDING' } }
                }
              },
              salaryStructureAssignments: {
                where: { status: 'ACTIVE' },
                include: { salaryStructure: true }
              }
            }
          },
          exitClearance: true
        }
      });

      if (!resignation) throw new Error('Resignation record not found');
      if (!resignation.exitClearance || resignation.exitClearance.status !== 'COMPLETED') {
        throw new Error('Exit Clearance must be completed before calculating final settlement.');
      }

      // Check if settlement already exists
      const existing = await tx.finalSettlement.findUnique({ where: { resignationId } });
      if (existing) {
        if (['APPROVED', 'PAID', 'CLOSED'].includes(existing.status)) {
          throw new Error('Final settlement already approved or paid.');
        }
        await tx.finalSettlement.delete({ where: { id: existing.id } });
      }

      const emp = resignation.employee;
      const salaryStruct = emp.salaryStructureAssignments[0]?.salaryStructure;

      // Calculate earnings (mocking proportional logic for now based on resignation fields)
      let pendingSalary = Number(resignation.pendingSalary);
      if (pendingSalary === 0 && salaryStruct) {
        // If not predefined in resignation, calculate based on gross salary roughly
        pendingSalary = Number(salaryStruct.grossSalary) * 0.5; // Example half month
      }

      const leaveEncashment = Number(resignation.leaveEncashment);
      const overtimeAmount = Number(resignation.overtime);
      const bonusAmount = Number(resignation.bonus);
      const otherEarnings = Number(resignation.gratuity);

      const totalEarnings = pendingSalary + leaveEncashment + overtimeAmount + bonusAmount + otherEarnings;

      // Calculate Deductions
      let loanRecovery = Number(resignation.loanDeduction);
      let advanceRecovery = Number(resignation.advanceDeduction);

      // Read directly from active loans if not set in resignation
      if (loanRecovery === 0 && advanceRecovery === 0) {
        emp.loans.forEach(loan => {
          loan.repaymentSchedules.forEach(sched => {
            if (loan.requestType === 'EMPLOYEE_LOAN') loanRecovery += Number(sched.installment);
            if (loan.requestType === 'SALARY_ADVANCE') advanceRecovery += Number(sched.installment);
          });
        });
      }

      const incomeTax = Number(resignation.taxDeduction);
      const noticePayRecovery = resignation.noticeWaived ? 0 : 0; // Simplified
      const assetRecovery = 0; // Derived from IT/Admin clearance normally
      const otherDeductions = 0;

      const totalDeductions = loanRecovery + advanceRecovery + incomeTax + noticePayRecovery + assetRecovery + otherDeductions;

      let netSettlement = totalEarnings - totalDeductions;
      if (netSettlement < 0) netSettlement = 0; // Usually company writes off or asks for cash

      const settlement = await tx.finalSettlement.create({
        data: {
          no: `FS-${Date.now().toString().slice(-6)}`,
          employeeId: emp.id,
          resignationId: resignation.id,
          separationType: resignation.resignationType,
          lastWorkingDate: resignation.lastWorkingDate,
          reason: resignation.reason,

          pendingSalary,
          leaveEncashment,
          overtimeAmount,
          bonusAmount,
          otherEarnings,
          totalEarnings,

          loanRecovery,
          advanceRecovery,
          incomeTax,
          noticePayRecovery,
          assetRecovery,
          otherDeductions,
          totalDeductions,

          netSettlement,
          status: 'CALCULATED',
        }
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'calculate-final-settlement',
          entityType: 'FinalSettlement',
          entityId: settlement.id,
          after: { employeeId: settlement.employeeId, netSettlement: settlement.netSettlement, status: settlement.status },
        },
        tx,
      );

      return settlement;
    });
  }

  static async updateApproval(session: AppSession | null, id: string, level: string, status: string, remarks?: string) {
    const actor = await authorize(session, 'hr:write');
    const settlement = await prisma.finalSettlement.findUnique({ where: { id } });
    if (!settlement) throw new Error('Settlement not found');

    let newStatus = settlement.status;
    let data: any = { remarks };

    if (status === 'REJECTED') {
      newStatus = 'REJECTED';
      data.hrApproval = null;
      data.financeApproval = null;
      data.managementApproval = null;
    } else {
      if (level === 'HR') {
        data.hrApproval = 'APPROVED';
        newStatus = 'PENDING_FINANCE';
      } else if (level === 'FINANCE') {
        data.financeApproval = 'APPROVED';
        newStatus = 'PENDING_MANAGEMENT';
      } else if (level === 'MANAGEMENT') {
        data.managementApproval = 'APPROVED';
        newStatus = 'APPROVED';
      }
    }

    data.status = newStatus;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.finalSettlement.update({
        where: { id },
        data
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'approve-final-settlement',
          entityType: 'FinalSettlement',
          entityId: id,
          before: { status: settlement.status },
          after: { status: updated.status, level, decision: status, remarks },
        },
        tx,
      );

      return updated;
    });
  }

  static async markPaid(
    session: AppSession | null,
    id: string,
    data: { paymentMethod: string, paymentDate: string, transactionRef?: string },
  ) {
    const actor = await authorize(session, 'hr:write');
    return prisma.$transaction(async (tx) => {
      const before = await tx.finalSettlement.findUnique({ where: { id } });
      const settlement = await tx.finalSettlement.update({
        where: { id },
        data: {
          paymentMethod: data.paymentMethod,
          paymentDate: new Date(data.paymentDate),
          transactionRef: data.transactionRef,
          status: 'PAID'
        }
      });

      // Close out active loans for this employee since recovered in final settlement
      await tx.loanRequest.updateMany({
        where: { employeeId: settlement.employeeId, status: 'ACTIVE' },
        data: { status: 'CLOSED' }
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'pay-final-settlement',
          entityType: 'FinalSettlement',
          entityId: id,
          before: { status: before?.status },
          after: { status: settlement.status, paymentMethod: settlement.paymentMethod, paymentDate: settlement.paymentDate },
        },
        tx,
      );

      return settlement;
    });
  }
}
