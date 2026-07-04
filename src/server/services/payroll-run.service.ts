import { prisma } from '@/server/db';
import { Prisma, PayrollRunStatus } from '@prisma/client';
import { CalculatePayrollFormValues } from '../validators/payroll-run';

export class PayrollRunService {
  static async getDashboardStats() {
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

  static async getPayrollRuns(where?: Prisma.PayrollRunWhereInput) {
    return prisma.payrollRun.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        payrollPeriod: { select: { name: true, month: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPayrollRunById(id: string) {
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

  static async calculatePayroll(data: CalculatePayrollFormValues) {
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
            where: { status: 'ACTIVE' },
            include: { salaryStructure: true },
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

      // 5. Calculate for each employee
      for (const emp of employees) {
        const assignment = emp.salaryStructureAssignments[0];
        
        if (!assignment) {
          throw new Error(`Employee ${emp.code} (${emp.firstName}) has no active salary structure.`);
        }

        const structure = assignment.salaryStructure;

        // Base Earnings
        let basic = Number(structure.basicSalary);
        let houseAllowance = Number(structure.houseAllowance);
        let medicalAllowance = Number(structure.medicalAllowance);
        let transportAllowance = Number(structure.transportAllowance);
        let otherAllowance = Number(structure.otherAllowance);

        // OT (Mocking 0 for now as Attendance module is not fully integrated here)
        let overtimeAmount = 0;
        let attendanceBonus = 0;

        // Bonus
        let bonusAmount = emp.bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

        // Loans & Advances
        let loanDeduction = 0;
        let advanceDeduction = 0;
        emp.loans.forEach(loan => {
          loan.repaymentSchedules.forEach(schedule => {
            if (loan.requestType === 'EMPLOYEE_LOAN') loanDeduction += Number(schedule.installment);
            if (loan.requestType === 'SALARY_ADVANCE') advanceDeduction += Number(schedule.installment);
          });
        });

        // Tax & PF
        let taxDeduction = Number(structure.taxDeduction);
        let providentFund = Number(structure.providentFund);

        // Adjustments
        let adjustmentsAddition = 0;
        let adjustmentsDeduction = 0;
        let lateDeduction = 0;
        let absentDeduction = 0;
        
        emp.payrollAdjustments.forEach(adj => {
          if (adj.type === 'DEDUCTION' || adj.type === 'ATTENDANCE_ADJUSTMENT' && Number(adj.amount) > 0) {
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
        
        let net = gross - totalDed;

        // Ensure net is not negative
        if (net < 0) {
          throw new Error(`Calculation error: Employee ${emp.code} has a negative net salary (${net}). Adjust deductions.`);
        }

        await tx.payslip.create({
          data: {
            no: `PS-${period.year}${period.month.toString().padStart(2, '0')}-${emp.code}`,
            payrollRunId: run.id,
            employeeId: emp.id,
            paymentMethod: emp.bankAccount ? 'Bank Transfer' : 'Cash',
            bankName: emp.bankName,
            bankAccount: emp.bankAccount,
            workedDays: 30, // Mocked
            leaveDays: 0,
            absentDays: 0,
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

      return updatedRun;
    });
  }

  static async approvePayroll(id: string, level: string, status: string, remarks?: string) {
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

    return prisma.payrollRun.update({
      where: { id },
      data
    });
  }

  static async closePayroll(id: string) {
    return prisma.$transaction(async (tx) => {
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
      
      return run;
    });
  }
}
