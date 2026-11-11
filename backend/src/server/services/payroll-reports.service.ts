import 'server-only';

import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';

export const PAYROLL_REPORT_TYPES = [
  'PAYROLL_SUMMARY',
  'SALARY_REGISTER',
  'PAYSLIP',
  'BONUS',
  'LOAN_ADVANCE',
  'PAYROLL_ADJUSTMENT',
  'FINAL_SETTLEMENT',
  'PAYROLL_COMPARISON',
  'SALARY_COST_CENTER',
  'PAYROLL_AUDIT',
] as const;

export type PayrollReportType = (typeof PAYROLL_REPORT_TYPES)[number];

export type PayrollReportFilters = {
  reportType?: PayrollReportType;
  payrollPeriodId?: string;
  payrollMonth?: string;
  branchId?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  employmentType?: string;
  salaryStatus?: string;
  payrollStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

function normalizeDateStart(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function normalizeDateEnd(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '—';
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function isFinalizedPayrollStatus(status: string) {
  return ['APPROVED', 'PAID', 'COMPLETED', 'CLOSED', 'LOCKED'].includes(status);
}

function matchesEmployeeFilters(
  employee: {
    branchId: string;
    department: string | null;
    designation: string | null;
    employmentType: string | null;
    id: string;
  },
  filters: PayrollReportFilters,
) {
  if (filters.branchId && employee.branchId !== filters.branchId) return false;
  if (filters.department && employee.department !== filters.department) return false;
  if (filters.designation && employee.designation !== filters.designation) return false;
  if (filters.employeeId && employee.id !== filters.employeeId) return false;
  if (filters.employmentType && employee.employmentType !== filters.employmentType) return false;
  return true;
}

function matchesRange(date: Date | null | undefined, from: Date | null, to: Date | null) {
  if (!date) return !from && !to;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function buildReportRows(args: {
  reportType: PayrollReportType;
  runs: Array<{
    id: string;
    period: string;
    status: string;
    branch: { name: string };
    payrollPeriod: { name: string | null } | null;
    totalEmployees: number;
    totalGross: number;
    totalDeduction: number;
    totalNet: number;
    totalOT: number;
    totalBonus: number;
    totalLoan: number;
    totalAdvance: number;
    totalTax: number;
    createdAt: Date;
    approvedAt: Date | null;
    paidAt: Date | null;
  }>;
  payslips: Array<{
    id: string;
    no: string | null;
    paymentStatus: string;
    status: string;
    paymentDate: Date | null;
    gross: number;
    net: number;
    bonus: number;
    overtimeAmount: number;
    taxDeduction: number;
    providentFund: number;
    loanDeduction: number;
    advanceDeduction: number;
    lateDeduction: number;
    absentDeduction: number;
    payrollAdjustmentsAddition: number;
    payrollAdjustmentsDeduction: number;
    otherDeduction: number;
    basic: number;
    employee: {
      id: string;
      code: string;
      firstName: string;
      lastName: string;
      department: string | null;
      designation: string | null;
      employmentType: string | null;
      branch: { name: string };
    };
    payrollRun: { period: string; status: string; payrollPeriod: { name: string | null } | null };
  }>;
  bonuses: Array<{
    name: string;
    bonusType: string;
    effectivePayrollMonth: string;
    status: string;
    employeeBonuses: Array<{
      amount: number;
      isPaid: boolean;
      employee: { code: string; firstName: string; lastName: string };
    }>;
  }>;
  loans: Array<{
    referenceNo: string;
    requestType: string;
    loanAmount: number;
    monthlyDeduction: number;
    outstandingBalance: number;
    status: string;
    employee: { code: string; firstName: string; lastName: string; department: string | null };
  }>;
  adjustments: Array<{
    no: string;
    adjustmentDate: Date;
    type: string;
    amount: number;
    status: string;
    reason: string;
    employee: { code: string; firstName: string; lastName: string; department: string | null };
    payrollPeriod: { name: string; month: number; year: number };
  }>;
  settlements: Array<{
    no: string;
    lastWorkingDate: Date;
    totalEarnings: number;
    totalDeductions: number;
    netSettlement: number;
    status: string;
    paymentDate: Date | null;
    employee: { code: string; firstName: string; lastName: string; department: string | null };
  }>;
}) {
  const { reportType, runs, payslips, bonuses, loans, adjustments, settlements } = args;

  switch (reportType) {
    case 'PAYROLL_SUMMARY': {
      const totals = runs.reduce(
        (acc, run) => {
          acc.employees += run.totalEmployees;
          acc.gross += run.totalGross;
          acc.bonus += run.totalBonus;
          acc.ot += run.totalOT;
          acc.deduction += run.totalDeduction;
          acc.net += run.totalNet;
          return acc;
        },
        { employees: 0, gross: 0, bonus: 0, ot: 0, deduction: 0, net: 0 },
      );

      return {
        title: 'Payroll Summary Report',
        description: 'Management view of finalized payroll runs and their total salary values.',
        columns: ['Payroll Month', 'Employees', 'Gross Salary', 'Total Bonus', 'Total OT', 'Total Deduction', 'Net Payroll'],
        rows: runs.length > 0
          ? runs.map((run) => [
              run.period,
              run.totalEmployees,
              formatMoney(run.totalGross),
              formatMoney(run.totalBonus),
              formatMoney(run.totalOT),
              formatMoney(run.totalDeduction),
              formatMoney(run.totalNet),
            ])
          : [[
              '—',
              totals.employees,
              formatMoney(totals.gross),
              formatMoney(totals.bonus),
              formatMoney(totals.ot),
              formatMoney(totals.deduction),
              formatMoney(totals.net),
            ]],
      };
    }
    case 'SALARY_REGISTER':
      return {
        title: 'Salary Register Report',
        description: 'Employee-wise salary register generated from finalized payslips.',
        columns: ['Employee ID', 'Employee', 'Basic', 'Gross', 'Bonus', 'OT', 'Deduction', 'Net Salary', 'Payment Status'],
        rows: payslips.map((slip) => {
          const deduction =
            slip.taxDeduction +
            slip.providentFund +
            slip.loanDeduction +
            slip.advanceDeduction +
            slip.lateDeduction +
            slip.absentDeduction +
            slip.payrollAdjustmentsDeduction +
            slip.otherDeduction;
          return [
            slip.employee.code,
            `${slip.employee.firstName} ${slip.employee.lastName}`,
            formatMoney(slip.basic),
            formatMoney(slip.gross),
            formatMoney(slip.bonus),
            formatMoney(slip.overtimeAmount),
            formatMoney(deduction),
            formatMoney(slip.net),
            slip.paymentStatus,
          ];
        }),
      };
    case 'PAYSLIP':
      return {
        title: 'Payslip Report',
        description: 'Payslip-level payroll output across the selected payroll scope.',
        columns: ['Payslip No', 'Employee', 'Payroll Month', 'Gross', 'Net', 'Payment Status'],
        rows: payslips.map((slip) => [
          slip.no ?? slip.id,
          `${slip.employee.firstName} ${slip.employee.lastName}`,
          slip.payrollRun.period,
          formatMoney(slip.gross),
          formatMoney(slip.net),
          slip.paymentStatus,
        ]),
      };
    case 'BONUS':
      return {
        title: 'Bonus Report',
        description: 'Bonus distributions from the Bonus module linked to payroll months.',
        columns: ['Employee', 'Bonus Type', 'Bonus Amount', 'Payroll Month', 'Status'],
        rows: bonuses.flatMap((bonus) =>
          bonus.employeeBonuses.map((employeeBonus) => [
            `${employeeBonus.employee.code} · ${employeeBonus.employee.firstName} ${employeeBonus.employee.lastName}`,
            bonus.bonusType,
            formatMoney(employeeBonus.amount),
            bonus.effectivePayrollMonth,
            bonus.status,
          ]),
        ),
      };
    case 'LOAN_ADVANCE':
      return {
        title: 'Loan & Advance Report',
        description: 'Loan and salary advance balances and monthly payroll deductions.',
        columns: ['Employee', 'Reference No', 'Type', 'Loan Amount', 'Deduction', 'Outstanding', 'Status'],
        rows: loans.map((loan) => [
          `${loan.employee.code} · ${loan.employee.firstName} ${loan.employee.lastName}`,
          loan.referenceNo,
          loan.requestType,
          formatMoney(loan.loanAmount),
          formatMoney(loan.monthlyDeduction),
          formatMoney(loan.outstandingBalance),
          loan.status,
        ]),
      };
    case 'PAYROLL_ADJUSTMENT':
      return {
        title: 'Payroll Adjustment Report',
        description: 'Approved, applied, and completed payroll adjustments by employee and payroll period.',
        columns: ['Adjustment No', 'Employee', 'Payroll Period', 'Type', 'Amount', 'Reason', 'Status', 'Date'],
        rows: adjustments.map((adjustment) => [
          adjustment.no,
          `${adjustment.employee.code} · ${adjustment.employee.firstName} ${adjustment.employee.lastName}`,
          adjustment.payrollPeriod.name,
          adjustment.type,
          formatMoney(adjustment.amount),
          adjustment.reason,
          adjustment.status,
          formatDate(adjustment.adjustmentDate),
        ]),
      };
    case 'FINAL_SETTLEMENT':
      return {
        title: 'Final Settlement Report',
        description: 'Final settlement outcomes for resigned employees, including earnings and deductions.',
        columns: ['Settlement No', 'Employee', 'Last Working Date', 'Total Earnings', 'Total Deductions', 'Net Settlement', 'Status'],
        rows: settlements.map((settlement) => [
          settlement.no,
          `${settlement.employee.code} · ${settlement.employee.firstName} ${settlement.employee.lastName}`,
          formatDate(settlement.lastWorkingDate),
          formatMoney(settlement.totalEarnings),
          formatMoney(settlement.totalDeductions),
          formatMoney(settlement.netSettlement),
          settlement.status,
        ]),
      };
    case 'PAYROLL_COMPARISON': {
      const grouped = runs
        .slice()
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((run) => [
          run.period,
          run.totalEmployees,
          formatMoney(run.totalGross),
          formatMoney(run.totalDeduction),
          formatMoney(run.totalNet),
        ]);
      return {
        title: 'Payroll Comparison Report',
        description: 'Month-over-month comparison across finalized payroll runs.',
        columns: ['Payroll Month', 'Employees', 'Gross Salary', 'Total Deductions', 'Net Payroll'],
        rows: grouped,
      };
    }
    case 'SALARY_COST_CENTER': {
      const grouped = new Map<string, { employees: Set<string>; gross: number; net: number }>();
      for (const slip of payslips) {
        const key = `${slip.employee.branch.name} / ${slip.employee.department ?? 'Unassigned'}`;
        const current = grouped.get(key) ?? { employees: new Set<string>(), gross: 0, net: 0 };
        current.employees.add(slip.employee.id);
        current.gross += slip.gross;
        current.net += slip.net;
        grouped.set(key, current);
      }
      return {
        title: 'Salary Cost Center Report',
        description: 'Salary allocation by branch and department, using the payroll dimensions currently stored in employee and payslip records.',
        columns: ['Cost Center', 'Employees', 'Gross Salary', 'Net Salary'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, row]) => [key, row.employees.size, formatMoney(row.gross), formatMoney(row.net)]),
      };
    }
    case 'PAYROLL_AUDIT':
    default:
      return {
        title: 'Payroll Audit Report',
        description: 'Audit-oriented view of finalized payroll runs, payment states, and control timestamps.',
        columns: ['Payroll Month', 'Run Status', 'Employees', 'Gross', 'Net', 'Approved Date', 'Paid Date', 'Branch'],
        rows: runs.map((run) => [
          run.period,
          run.status,
          run.totalEmployees,
          formatMoney(run.totalGross),
          formatMoney(run.totalNet),
          formatDate(run.approvedAt),
          formatDate(run.paidAt),
          run.branch.name,
        ]),
      };
  }
}

export const payrollReportsService = {
  async getReportCenter(session: AppSession | null, filters: PayrollReportFilters = {}) {
    await authorize(session, 'hr:read');

    const reportType = filters.reportType ?? 'PAYROLL_SUMMARY';
    const from = normalizeDateStart(filters.dateFrom);
    const to = normalizeDateEnd(filters.dateTo);

    const [periods, employees, runsRaw, payslipsRaw, bonusesRaw, loansRaw, adjustmentsRaw, settlementsRaw] = await Promise.all([
      prisma.payrollPeriod.findMany({
        select: { id: true, name: true, month: true, year: true, status: true },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE', 'RESIGNED'] } },
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          branchId: true,
          department: true,
          designation: true,
          employmentType: true,
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.payrollRun.findMany({
        include: {
          branch: { select: { name: true } },
          payrollPeriod: { select: { name: true } },
        },
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.payslip.findMany({
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
              employmentType: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
          payrollRun: {
            select: {
              period: true,
              status: true,
              payrollPeriodId: true,
              payrollPeriod: { select: { name: true } },
              branchId: true,
              createdAt: true,
              approvedAt: true,
              paidAt: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.bonus.findMany({
        include: {
          employeeBonuses: {
            include: {
              employee: {
                select: {
                  id: true,
                  code: true,
                  firstName: true,
                  lastName: true,
                  branchId: true,
                  department: true,
                  designation: true,
                  employmentType: true,
                },
              },
            },
          },
        },
        orderBy: [{ effectivePayrollMonth: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.loanRequest.findMany({
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              branchId: true,
              department: true,
              designation: true,
              employmentType: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.payrollAdjustment.findMany({
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              branchId: true,
              department: true,
              designation: true,
              employmentType: true,
            },
          },
          payrollPeriod: { select: { name: true, month: true, year: true } },
        },
        orderBy: [{ adjustmentDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.finalSettlement.findMany({
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              branchId: true,
              department: true,
              designation: true,
              employmentType: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    const filteredRuns = runsRaw
      .filter((run) => isFinalizedPayrollStatus(run.status))
      .filter((run) => !filters.payrollPeriodId || run.payrollPeriodId === filters.payrollPeriodId)
      .filter((run) => !filters.payrollMonth || run.period === filters.payrollMonth)
      .filter((run) => !filters.branchId || run.branchId === filters.branchId)
      .filter((run) => !filters.payrollStatus || run.status === filters.payrollStatus)
      .filter((run) => matchesRange(run.createdAt, from, to));

    const allowedRunIds = new Set(filteredRuns.map((run) => run.id));
    const filteredPayslips = payslipsRaw
      .filter((slip) => allowedRunIds.has(slip.payrollRunId))
      .filter((slip) => matchesEmployeeFilters(slip.employee, filters))
      .filter((slip) => !filters.salaryStatus || slip.paymentStatus === filters.salaryStatus);

    const filteredBonuses = bonusesRaw
      .filter((bonus) => !filters.payrollMonth || bonus.effectivePayrollMonth === filters.payrollMonth)
      .filter((bonus) => !from || !to || matchesRange(new Date(`${bonus.effectivePayrollMonth}-01T00:00:00.000Z`), from, to))
      .map((bonus) => ({
        ...bonus,
        employeeBonuses: bonus.employeeBonuses.filter((employeeBonus) => matchesEmployeeFilters(employeeBonus.employee, filters)),
      }))
      .filter((bonus) => bonus.employeeBonuses.length > 0);

    const filteredLoans = loansRaw
      .filter((loan) => matchesEmployeeFilters(loan.employee, filters))
      .filter((loan) => matchesRange(loan.createdAt, from, to));

    const filteredAdjustments = adjustmentsRaw
      .filter((adjustment) => matchesEmployeeFilters(adjustment.employee, filters))
      .filter((adjustment) => !filters.payrollPeriodId || adjustment.payrollPeriodId === filters.payrollPeriodId)
      .filter((adjustment) => !filters.payrollMonth || `${adjustment.payrollPeriod.year}-${String(adjustment.payrollPeriod.month).padStart(2, '0')}` === filters.payrollMonth)
      .filter((adjustment) => matchesRange(adjustment.adjustmentDate, from, to));

    const filteredSettlements = settlementsRaw
      .filter((settlement) => matchesEmployeeFilters(settlement.employee, filters))
      .filter((settlement) => matchesRange(settlement.lastWorkingDate, from, to));

    const runsForRows = filteredRuns.map((run) => ({
      id: run.id,
      period: run.period,
      status: run.status,
      branch: run.branch,
      payrollPeriod: run.payrollPeriod,
      totalEmployees: run.totalEmployees,
      totalGross: Number(run.totalGross),
      totalDeduction: Number(run.totalDeduction),
      totalNet: Number(run.totalNet),
      totalOT: Number(run.totalOT),
      totalBonus: Number(run.totalBonus),
      totalLoan: Number(run.totalLoan),
      totalAdvance: Number(run.totalAdvance),
      totalTax: Number(run.totalTax),
      createdAt: run.createdAt,
      approvedAt: run.approvedAt,
      paidAt: run.paidAt,
    }));

    const payslipsForRows = filteredPayslips.map((slip) => ({
      id: slip.id,
      no: slip.no,
      paymentStatus: slip.paymentStatus,
      status: slip.status,
      paymentDate: slip.paymentDate,
      gross: Number(slip.gross),
      net: Number(slip.net),
      bonus: Number(slip.bonus),
      overtimeAmount: Number(slip.overtimeAmount),
      taxDeduction: Number(slip.taxDeduction),
      providentFund: Number(slip.providentFund),
      loanDeduction: Number(slip.loanDeduction),
      advanceDeduction: Number(slip.advanceDeduction),
      lateDeduction: Number(slip.lateDeduction),
      absentDeduction: Number(slip.absentDeduction),
      payrollAdjustmentsAddition: Number(slip.payrollAdjustmentsAddition),
      payrollAdjustmentsDeduction: Number(slip.payrollAdjustmentsDeduction),
      otherDeduction: Number(slip.otherDeduction),
      basic: Number(slip.basic),
      employee: slip.employee,
      payrollRun: slip.payrollRun,
    }));

    const bonusesForRows = filteredBonuses.map((bonus) => ({
      name: bonus.name,
      bonusType: bonus.bonusType,
      effectivePayrollMonth: bonus.effectivePayrollMonth,
      status: bonus.status,
      employeeBonuses: bonus.employeeBonuses.map((employeeBonus) => ({
        amount: Number(employeeBonus.amount),
        isPaid: employeeBonus.isPaid,
        employee: employeeBonus.employee,
      })),
    }));

    const loansForRows = filteredLoans.map((loan) => ({
      referenceNo: loan.referenceNo,
      requestType: loan.requestType,
      loanAmount: Number(loan.loanAmount),
      monthlyDeduction: Number(loan.monthlyDeduction),
      outstandingBalance: Number(loan.outstandingBalance),
      status: loan.status,
      employee: loan.employee,
    }));

    const adjustmentsForRows = filteredAdjustments.map((adjustment) => ({
      no: adjustment.no,
      adjustmentDate: adjustment.adjustmentDate,
      type: adjustment.type,
      amount: Number(adjustment.amount),
      status: adjustment.status,
      reason: adjustment.reason,
      employee: adjustment.employee,
      payrollPeriod: adjustment.payrollPeriod,
    }));

    const settlementsForRows = filteredSettlements.map((settlement) => ({
      no: settlement.no,
      lastWorkingDate: settlement.lastWorkingDate,
      totalEarnings: Number(settlement.totalEarnings),
      totalDeductions: Number(settlement.totalDeductions),
      netSettlement: Number(settlement.netSettlement),
      status: settlement.status,
      paymentDate: settlement.paymentDate,
      employee: settlement.employee,
    }));

    const latestRun = runsForRows[0] ?? null;

    const report = buildReportRows({
      reportType,
      runs: runsForRows,
      payslips: payslipsForRows,
      bonuses: bonusesForRows,
      loans: loansForRows,
      adjustments: adjustmentsForRows,
      settlements: settlementsForRows,
    });

    return {
      filters: {
        reportType,
        payrollPeriodId: filters.payrollPeriodId ?? '',
        payrollMonth: filters.payrollMonth ?? '',
        branchId: filters.branchId ?? '',
        department: filters.department ?? '',
        designation: filters.designation ?? '',
        employeeId: filters.employeeId ?? '',
        employmentType: filters.employmentType ?? '',
        salaryStatus: filters.salaryStatus ?? '',
        payrollStatus: filters.payrollStatus ?? '',
        dateFrom: filters.dateFrom ?? '',
        dateTo: filters.dateTo ?? '',
      },
      options: {
        payrollPeriods: periods.map((period) => ({ value: period.id, label: period.name })),
        payrollMonths: Array.from(new Set(runsRaw.map((run) => run.period))).sort((a, b) => b.localeCompare(a)),
        branches: Array.from(new Map(employees.map((employee) => [employee.branch.id, employee.branch])).values()).sort((a, b) => a.code.localeCompare(b.code)),
        departments: Array.from(new Set(employees.map((employee) => employee.department).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        designations: Array.from(new Set(employees.map((employee) => employee.designation).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        employees: employees.map((employee) => ({ value: employee.id, label: `${employee.code} · ${employee.firstName} ${employee.lastName}` })),
        employmentTypes: Array.from(new Set(employees.map((employee) => employee.employmentType).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        salaryStatuses: ['PAID', 'PENDING', 'FAILED'],
        payrollStatuses: ['APPROVED', 'PAID', 'COMPLETED', 'CLOSED', 'LOCKED'],
      },
      dashboard: {
        payrollMonth: latestRun?.period ?? '—',
        employeesPaid: payslipsForRows.filter((slip) => slip.paymentStatus === 'PAID').length,
        totalGrossSalary: latestRun ? formatMoney(latestRun.totalGross) : '0.00',
        totalDeductions: latestRun ? formatMoney(latestRun.totalDeduction) : '0.00',
        totalNetSalary: latestRun ? formatMoney(latestRun.totalNet) : '0.00',
      },
      report,
      meta: {
        rowCount: report.rows.length,
      },
    };
  },
};
