import { prisma } from '@/server/db';
import { Prisma, PayrollRunStatus } from '@prisma/client';
import { CalculatePayrollFormValues } from '../validators/payroll-run';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

function resolveSalaryFromStructure(
  assignment:
    | {
        salaryStructure: {
          grossSalary: Prisma.Decimal;
          netSalary: Prisma.Decimal | null;
          components: Array<{
            value: Prisma.Decimal;
            salaryComponent: {
              code: string;
              category: string;
              calculationType: string;
              baseComponent: string | null;
            };
          }>;
        };
      }
    | undefined,
) {
  if (!assignment) return null;

  const componentValues = new Map<string, number>();
  const components = assignment.salaryStructure.components;

  const getResolvedByCode = (code: string) => componentValues.get(code) ?? 0;

  const resolveBase = (baseComponent: string | null) => {
    if (!baseComponent) return 0;
    if (baseComponent === 'GROSS') {
      return components.reduce((sum, component) => {
        if (component.salaryComponent.category === 'EARNINGS') {
          return sum + (componentValues.get(component.salaryComponent.code) ?? 0);
        }
        return sum;
      }, 0);
    }
    if (baseComponent === 'NET') {
      const earnings = components.reduce((sum, component) => {
        if (component.salaryComponent.category === 'EARNINGS') {
          return sum + (componentValues.get(component.salaryComponent.code) ?? 0);
        }
        return sum;
      }, 0);
      const deductions = components.reduce((sum, component) => {
        if (component.salaryComponent.category === 'DEDUCTION') {
          return sum + (componentValues.get(component.salaryComponent.code) ?? 0);
        }
        return sum;
      }, 0);
      return earnings - deductions;
    }
    return getResolvedByCode(baseComponent);
  };

  for (const component of components) {
    let amount = Number(component.value);
    if (component.salaryComponent.calculationType === 'PERCENTAGE') {
      amount = (resolveBase(component.salaryComponent.baseComponent) * amount) / 100;
    }
    componentValues.set(component.salaryComponent.code, amount);
  }

  const basic = getResolvedByCode('BASIC');
  const houseAllowance = getResolvedByCode('HRA');
  const medicalAllowance = getResolvedByCode('MEDICAL');
  const transportAllowance = getResolvedByCode('TRANSPORT');
  const otherAllowance = getResolvedByCode('OTHER_ALLOWANCE');
  const taxDeduction = getResolvedByCode('TAX_DEDUCTION');
  const providentFund = getResolvedByCode('PROVIDENT_FUND');

  return {
    basic,
    houseAllowance,
    medicalAllowance,
    transportAllowance,
    otherAllowance,
    taxDeduction,
    providentFund,
    gross: Number(assignment.salaryStructure.grossSalary),
    net: assignment.salaryStructure.netSalary ? Number(assignment.salaryStructure.netSalary) : null,
  };
}

export class PayrollRunService {
  static async getDashboardStats(session: AppSession | null) {
    await authorize(session, 'hr:read');
    const currentPeriod = await prisma.payrollPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startDate: 'desc' }
    });

    const stats = {
      month: currentPeriod ? currentPeriod.name : 'N/A',
      employees: 0,
      completed: 0,
      pending: 0,
      totalPayroll: 0
    };

    if (currentPeriod) {
      stats.employees = await prisma.employee.count({ where: { status: 'ACTIVE' } });
      
      const runs = await prisma.payrollRun.findMany({
        where: { payrollPeriodId: currentPeriod.id },
        include: { _count: { select: { payslips: true } } }
      });

      for (const run of runs) {
        if (run.status === 'COMPLETED' || run.status === 'CLOSED' || run.status === 'PAID') {
          stats.completed += run._count.payslips;
          stats.totalPayroll += Number(run.totalNet);
        } else {
          stats.pending += run._count.payslips;
        }
      }
      
      if (stats.completed === 0 && stats.pending === 0) {
        stats.pending = stats.employees;
      }
    }

    return stats;
  }

  static async getPayrollRuns(session: AppSession | null, where?: Prisma.PayrollRunWhereInput) {
    await authorize(session, 'hr:read');
    return prisma.payrollRun.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        payrollPeriod: { select: { name: true, month: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPayrollRunById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    return prisma.payrollRun.findUnique({
      where: { id },
      include: {
        branch: { select: { name: true } },
        payrollPeriod: { select: { name: true, month: true, year: true, status: true } },
        payslips: {
          include: {
            employee: { select: { firstName: true, lastName: true, code: true, department: true, designation: true } }
          }
        }
      }
    });
  }

  static async calculatePayroll(session: AppSession | null, data: CalculatePayrollFormValues) {
    const actor = await authorize(session, 'hr:process-payroll');
    const { payrollPeriodId, branchId, departmentId, sectionId, employmentType } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Verify Period
      const period = await tx.payrollPeriod.findUnique({ where: { id: payrollPeriodId } });
      if (!period || period.status !== 'OPEN') {
        throw new Error('Payroll period is not open.');
      }

      // 2. Check for existing run
      const existingRun = await tx.payrollRun.findFirst({
        where: {
          payrollPeriodId,
          branchId,
          status: { notIn: ['CANCELLED'] }
        }
      });
      
      if (existingRun) {
        if (['APPROVED', 'PAID', 'COMPLETED', 'CLOSED', 'LOCKED'].includes(existingRun.status)) {
          throw new Error('A finalized payroll run already exists for this branch and period.');
        } else {
          // Delete existing draft/pending run to recalculate
          await tx.payrollRun.delete({ where: { id: existingRun.id } });
        }
      }

      // 3. Fetch Employees
      const employeeWhere: Prisma.EmployeeWhereInput = {
        status: 'ACTIVE',
        branchId,
      };
      if (departmentId) employeeWhere.department = departmentId;
      if (employmentType) employeeWhere.employmentType = employmentType as any;

      const employees = await tx.employee.findMany({
        where: employeeWhere,
        include: {
          salaryStructureAssignments: {
            where: {
              effectiveFrom: { lte: period.endDate },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: period.startDate } },
              ],
            },
            include: {
              salaryStructure: {
                include: {
                  components: {
                    include: {
                      salaryComponent: {
                        select: {
                          code: true,
                          category: true,
                          calculationType: true,
                          baseComponent: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { effectiveFrom: 'desc' },
            take: 1
          },
          bonuses: {
            where: {
              isPaid: false,
              bonus: {
                effectivePayrollMonth: `${period.year}-${period.month.toString().padStart(2, '0')}`,
                status: 'PUBLISHED'
              }
            }
          },
          loans: {
            where: { status: 'ACTIVE' },
            include: {
              repaymentSchedules: {
                where: {
                  payrollMonth: `${period.year}-${period.month.toString().padStart(2, '0')}`,
                  status: 'PENDING'
                }
              }
            }
          },
          payrollAdjustments: {
            where: {
              payrollPeriodId,
              status: 'APPROVED'
            }
          },
          overtimeRecords: {
            where: {
              otMonth: `${period.year}-${period.month.toString().padStart(2, '0')}`,
              status: 'APPROVED'
            }
          },
          attendance: {
            where: {
              date: {
                gte: period.startDate,
                lte: period.endDate
              }
            }
          },
          leaves: {
            where: {
              status: 'APPROVED',
              fromDate: { lte: period.endDate },
              toDate: { gte: period.startDate }
            }
          }
        }
      });

      if (employees.length === 0) {
        throw new Error('No eligible employees found for the selected criteria.');
      }

      // 4. Create Run
      const run = await tx.payrollRun.create({
        data: {
          branchId,
          payrollPeriodId,
          period: `${period.year}-${period.month.toString().padStart(2, '0')}`,
          status: 'CALCULATED',
        }
      });

      let totalGross = 0;
      let totalNet = 0;
      let totalDeduction = 0;
      let totalOT = 0;
      let totalBonus = 0;
      let totalLoan = 0;
      let totalAdvance = 0;
      let totalTax = 0;

      const totalPeriodDays = Math.max(1, Math.round((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      // 5. Calculate for each employee
      for (const emp of employees) {
        const assignment = emp.salaryStructureAssignments[0];
        const structuredSalary = resolveSalaryFromStructure(assignment);

        // Base Earnings
        let basic = structuredSalary?.basic ?? Number(emp.basicSalary);
        let houseAllowance = structuredSalary?.houseAllowance ?? Number(emp.houseAllowance);
        let medicalAllowance = structuredSalary?.medicalAllowance ?? Number(emp.medicalAllowance);
        let transportAllowance = structuredSalary?.transportAllowance ?? Number(emp.transportAllowance);
        let otherAllowance = structuredSalary?.otherAllowance ?? Number(emp.otherAllowance);

        // OT
        let overtimeAmount = period.includeOvertime
          ? emp.overtimeRecords.reduce((sum, ot) => sum + Number(ot.otAmount), 0)
          : 0;
        let attendanceBonus = 0;

        // Bonus
        let bonusAmount = period.includeBonus
          ? emp.bonuses.reduce((sum, b) => sum + Number(b.amount), 0)
          : 0;

        // Loans & Advances
        let loanDeduction = 0;
        let advanceDeduction = 0;
        emp.loans.forEach(loan => {
          loan.repaymentSchedules.forEach(schedule => {
            if (period.includeLoanDeduction && loan.requestType === 'EMPLOYEE_LOAN') loanDeduction += Number(schedule.installment);
            if (period.includeSalaryAdvance && loan.requestType === 'SALARY_ADVANCE') advanceDeduction += Number(schedule.installment);
          });
        });

        // Tax & PF
        let taxDeduction = period.includeTax ? (structuredSalary?.taxDeduction ?? Number(emp.taxDeduction)) : 0;
        let providentFund = structuredSalary?.providentFund ?? Number(emp.providentFund);

        // Adjustments
        let adjustmentsAddition = 0;
        let adjustmentsDeduction = 0;
        let lateDeduction = 0;
        let absentDeduction = 0;
        
        emp.payrollAdjustments.forEach(adj => {
          if (adj.type === 'DEDUCTION' || (adj.type === 'ATTENDANCE_ADJUSTMENT' && Number(adj.amount) > 0)) {
            adjustmentsDeduction += Number(adj.amount);
            if (adj.reason === 'LATE_SALARY_REVISION') lateDeduction += Number(adj.amount);
            if (adj.reason === 'ATTENDANCE_CORRECTION') absentDeduction += Number(adj.amount);
          } else {
            adjustmentsAddition += Number(adj.amount);
          }
        });

        let gross = basic + houseAllowance + medicalAllowance + transportAllowance + otherAllowance + attendanceBonus + overtimeAmount + bonusAmount + adjustmentsAddition;
        
        let otherDeduction = adjustmentsDeduction - lateDeduction - absentDeduction;
        if (otherDeduction < 0) otherDeduction = 0;

        let totalDed = taxDeduction + providentFund + loanDeduction + advanceDeduction + lateDeduction + absentDeduction + otherDeduction;
        
        let net = Math.max(0, gross - totalDed);

        const presentCount = emp.attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
        const halfDayCount = emp.attendance.filter(a => a.status === 'HALF_DAY').length;
        const absentCount = emp.attendance.filter(a => a.status === 'ABSENT').length;
        const leaveDays = emp.leaves.reduce((sum, l) => sum + Number(l.days), 0);
        const workedDays = emp.attendance.length > 0 ? (presentCount + halfDayCount * 0.5) : totalPeriodDays;
        const absentDays = emp.attendance.length > 0 ? absentCount : 0;

        await tx.payslip.create({
          data: {
            no: `PS-${period.year}${period.month.toString().padStart(2, '0')}-${emp.code}`,
            payrollRunId: run.id,
            employeeId: emp.id,
            paymentMethod: emp.bankAccount ? 'Bank Transfer' : 'Cash',
            bankName: emp.bankName,
            bankAccount: emp.bankAccount,
            workedDays: Math.round(workedDays),
            leaveDays: Math.round(leaveDays),
            absentDays: Math.round(absentDays),
            basic,
            houseAllowance,
            transportAllowance,
            medicalAllowance,
            otherAllowance,
            attendanceBonus,
            overtimeAmount,
            bonus: bonusAmount,
            payrollAdjustmentsAddition: adjustmentsAddition,
            providentFund,
            taxDeduction,
            loanDeduction,
            advanceDeduction,
            lateDeduction,
            absentDeduction,
            payrollAdjustmentsDeduction: otherDeduction, // Storing remaining ded here
            otherDeduction: 0,
            gross,
            net
          }
        });

        totalGross += gross;
        totalNet += net;
        totalDeduction += totalDed;
        totalOT += overtimeAmount;
        totalBonus += bonusAmount;
        totalLoan += loanDeduction;
        totalAdvance += advanceDeduction;
        totalTax += taxDeduction;
      }

      // 6. Update Run Totals
      const updatedRun = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          totalEmployees: employees.length,
          totalGross,
          totalNet,
          totalDeduction,
          totalOT,
          totalBonus,
          totalLoan,
          totalAdvance,
          totalTax
        }
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'calculate-payroll',
          entityType: 'PayrollRun',
          entityId: updatedRun.id,
          after: {
            period: updatedRun.period,
            branchId: updatedRun.branchId,
            totalEmployees: updatedRun.totalEmployees,
            totalGross,
            totalNet,
          },
        },
        tx,
      );

      return updatedRun;
    });
  }

  static async approvePayroll(
    session: AppSession | null,
    id: string,
    level: string,
    status: string,
    remarks?: string,
  ) {
    const actor = await authorize(session, 'hr:approve-payroll');
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new Error('Payroll run not found');

    let newStatus = run.status;
    let data: any = {};

    if (status === 'REJECTED') {
      newStatus = 'CALCULATED'; // Reset to calculated for fixes
      data = {
        hrApproval: null,
        financeApproval: null,
        managementApproval: null,
        status: newStatus,
        notes: remarks ? `Rejected by ${level}: ${remarks}` : `Rejected by ${level}`
      };
    } else if (status === 'APPROVED') {
      if (level === 'HR') {
        newStatus = 'PENDING_FINANCE';
        data = { hrApproval: 'APPROVED', status: newStatus };
      } else if (level === 'FINANCE') {
        newStatus = 'PENDING_MANAGEMENT';
        data = { financeApproval: 'APPROVED', status: newStatus };
      } else if (level === 'MANAGEMENT') {
        newStatus = 'APPROVED';
        data = { managementApproval: 'APPROVED', status: newStatus, approvedAt: new Date() };
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payrollRun.update({
        where: { id },
        data,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'approve-payroll',
          entityType: 'PayrollRun',
          entityId: id,
          before: { status: run.status },
          after: { status: updated.status, level, decision: status, remarks },
        },
        tx,
      );

      return updated;
    });
  }

  static async closePayroll(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:pay-payroll');
    return prisma.$transaction(async (tx) => {
      const before = await tx.payrollRun.findUnique({ where: { id } });
      const run = await tx.payrollRun.update({
        where: { id },
        data: { status: 'COMPLETED' } // Assuming COMPLETED triggers lock
      });
      
      // We would also mark Loans as PAID and Bonuses as isPaid here
      const payslips = await tx.payslip.findMany({ where: { payrollRunId: id } });
      
      for (const slip of payslips) {
        // Find loans for this slip and mark schedules as PAID
        const schedules = await tx.loanRepaymentSchedule.findMany({
          where: {
            loanRequest: { employeeId: slip.employeeId },
            payrollMonth: run.period,
            status: 'PENDING'
          }
        });
        
        for (const s of schedules) {
          await tx.loanRepaymentSchedule.update({
            where: { id: s.id },
            data: { status: 'PAID', payrollRunId: run.id }
          });
        }
        
        // Find bonuses and mark as PAID
        await tx.employeeBonus.updateMany({
          where: {
            employeeId: slip.employeeId,
            bonus: { effectivePayrollMonth: run.period },
            isPaid: false
          },
          data: { isPaid: true, payrollRunId: run.id }
        });
        
        // Find adjustments and mark as APPLIED
        await tx.payrollAdjustment.updateMany({
          where: {
            employeeId: slip.employeeId,
            payrollPeriodId: run.payrollPeriodId!,
            status: 'APPROVED'
          },
          data: { status: 'APPLIED', payrollRunId: run.id }
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'close-payroll',
          entityType: 'PayrollRun',
          entityId: id,
          before: { status: before?.status },
          after: { status: run.status, totalEmployees: run.totalEmployees, totalNet: run.totalNet },
        },
        tx,
      );

      return run;
    });
  }
}
