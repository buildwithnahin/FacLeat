import 'server-only';

import type { Prisma } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { isConfirmationTableAvailable } from '@/server/services/confirmations.service';
import { isIncrementTableAvailable } from '@/server/services/increments.service';
import { isPromotionTableAvailable } from '@/server/services/promotions.service';
import { isResignationTableAvailable } from '@/server/services/resignations.service';

export const LIFECYCLE_REPORT_TYPES = [
  'CONFIRMATION',
  'TRANSFER',
  'PROMOTION',
  'INCREMENT',
  'RESIGNATION',
  'TERMINATION',
  'EXIT_CLEARANCE',
  'FINAL_SETTLEMENT',
  'EMPLOYEE_MOVEMENT',
  'LIFECYCLE_SUMMARY',
] as const;

export type LifecycleReportType = (typeof LIFECYCLE_REPORT_TYPES)[number];

export type LifecycleReportFilters = {
  reportType?: LifecycleReportType;
  branchId?: string;
  department?: string;
  designation?: string;
  employmentType?: string;
  employeeId?: string;
  lifecycleType?: string;
  status?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  lastWorkingFrom?: string;
  lastWorkingTo?: string;
};

type EmployeeOptionRecord = Prisma.EmployeeGetPayload<{
  select: {
    id: true;
    code: true;
    firstName: true;
    lastName: true;
    branchId: true;
    department: true;
    designation: true;
    employmentType: true;
    status: true;
    leftAt: true;
    joinedAt: true;
    branch: { select: { id: true; code: true; name: true } };
  };
}>;

type ConfirmationRecord = Prisma.EmployeeConfirmationGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        joinedAt: true;
        branchId: true;
      };
    };
  };
}>;

type IncrementRecord = Prisma.EmployeeIncrementGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
      };
    };
    reportingManager: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

type PromotionRecord = Prisma.EmployeePromotionGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
      };
    };
    reportingManager: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

type TransferRecord = Prisma.EmployeeTransferGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
      };
    };
    branch: { select: { id: true; code: true; name: true } };
    newBranch: { select: { id: true; code: true; name: true } };
    tempBranch: { select: { id: true; code: true; name: true } };
  };
}>;

type ResignationRecord = Prisma.EmployeeResignationGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
      };
    };
  };
}>;

type ExitClearanceRecord = Prisma.EmployeeExitClearanceGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
      };
    };
  };
}>;

type FinalSettlementRecord = Prisma.FinalSettlementGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
      };
    };
  };
}>;

type MovementRow = {
  type: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  employmentType: string;
  eventDate: string;
  detail: string;
  status: string;
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

function matchesEmployeeLike(
  employee: {
    branchId: string;
    department: string | null;
    designation: string | null;
    employmentType: string | null;
    id: string;
  },
  filters: LifecycleReportFilters,
) {
  if (filters.branchId && employee.branchId !== filters.branchId) return false;
  if (filters.department && employee.department !== filters.department) return false;
  if (filters.designation && employee.designation !== filters.designation) return false;
  if (filters.employmentType && employee.employmentType !== filters.employmentType) return false;
  if (filters.employeeId && employee.id !== filters.employeeId) return false;
  return true;
}

function matchesStatus(value: string, filters: LifecycleReportFilters) {
  if (!filters.status) return true;
  return value === filters.status;
}

function matchesEffectiveDate(value: Date | null | undefined, from: Date | null, to: Date | null) {
  if (!value) return !from && !to;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function matchesLastWorkingDate(value: Date | null | undefined, from: Date | null, to: Date | null) {
  if (!value) return !from && !to;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function incrementApproverLabel(record: IncrementRecord) {
  if (record.managerApprovalDate && record.reportingManager) {
    return `${record.reportingManager.firstName} ${record.reportingManager.lastName}`;
  }
  if (record.status === 'APPROVED' || record.status === 'APPLIED') return 'Approval Workflow';
  return '—';
}

function buildReportRows(args: {
  reportType: LifecycleReportType;
  confirmations: ConfirmationRecord[];
  transfers: TransferRecord[];
  promotions: PromotionRecord[];
  increments: IncrementRecord[];
  resignations: ResignationRecord[];
  terminations: EmployeeOptionRecord[];
  exitClearances: ExitClearanceRecord[];
  settlements: FinalSettlementRecord[];
  lifecycleType: string;
}) {
  const {
    reportType,
    confirmations,
    transfers,
    promotions,
    increments,
    resignations,
    terminations,
    exitClearances,
    settlements,
    lifecycleType,
  } = args;

  const movementRows: MovementRow[] = [
    ...confirmations.map((record) => ({
      type: 'CONFIRMATION',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.effectiveDate),
      detail: `Confirmation ${record.confirmationNumber}`,
      status: record.status,
    })),
    ...transfers.map((record) => ({
      type: 'TRANSFER',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.effectiveDate ?? record.startDate),
      detail: `${record.currentDepartment ?? '—'} -> ${record.newDepartment ?? record.tempDepartment ?? record.newBranch?.name ?? record.tempBranch?.name ?? '—'}`,
      status: record.status,
    })),
    ...promotions.map((record) => ({
      type: 'PROMOTION',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.effectiveDate),
      detail: `${record.currentDesignation ?? '—'} -> ${record.newDesignation}`,
      status: record.status,
    })),
    ...increments.map((record) => ({
      type: 'INCREMENT',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.effectiveDate),
      detail: `${formatMoney(Number(record.currentBasicSalary))} -> ${formatMoney(Number(record.newBasicSalary))}`,
      status: record.status,
    })),
    ...resignations.map((record) => ({
      type: 'RESIGNATION',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.lastWorkingDate),
      detail: record.reason,
      status: record.status,
    })),
    ...terminations.map((record) => ({
      type: 'TERMINATION',
      employeeCode: record.code,
      employeeName: `${record.firstName} ${record.lastName}`,
      department: record.department ?? '—',
      designation: record.designation ?? '—',
      employmentType: record.employmentType ?? '—',
      eventDate: formatDate(record.leftAt),
      detail: 'Employee status marked TERMINATED',
      status: record.status,
    })),
    ...exitClearances.map((record) => ({
      type: 'EXIT_CLEARANCE',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.lastWorkingDate),
      detail: record.clearanceNumber,
      status: record.status,
    })),
    ...settlements.map((record) => ({
      type: 'FINAL_SETTLEMENT',
      employeeCode: record.employee.code,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      department: record.employee.department ?? '—',
      designation: record.employee.designation ?? '—',
      employmentType: record.employee.employmentType ?? '—',
      eventDate: formatDate(record.lastWorkingDate),
      detail: record.no,
      status: record.status,
    })),
  ]
    .filter((row) => !lifecycleType || row.type === lifecycleType)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.employeeCode.localeCompare(b.employeeCode));

  switch (reportType) {
    case 'CONFIRMATION':
      return {
        title: 'Confirmation Report',
        description: 'Employees confirmed after probation or internship through the confirmation workflow.',
        columns: ['Employee', 'Department', 'Designation', 'Joining Date', 'Confirmation Date', 'Status'],
        rows: confirmations.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          record.employee.department ?? '—',
          record.employee.designation ?? '—',
          formatDate(record.employee.joinedAt),
          formatDate(record.confirmedAt ?? record.effectiveDate),
          record.status,
        ]),
      };
    case 'TRANSFER':
      return {
        title: 'Transfer Report',
        description: 'Employee branch, department, and temporary transfer movements.',
        columns: ['Employee', 'Transfer Date', 'From Department', 'To Department', 'From Branch', 'To Branch', 'Status'],
        rows: transfers.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          formatDate(record.effectiveDate ?? record.startDate),
          record.currentDepartment ?? '—',
          record.newDepartment ?? record.tempDepartment ?? '—',
          record.currentBranch ?? '—',
          record.newBranch?.name ?? record.tempBranch?.name ?? '—',
          record.status,
        ]),
      };
    case 'PROMOTION':
      return {
        title: 'Promotion Report',
        description: 'Employee promotions and designation changes from the promotion workflow.',
        columns: ['Employee', 'Promotion Date', 'Old Designation', 'New Designation', 'Approved By'],
        rows: promotions.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          formatDate(record.effectiveDate),
          record.currentDesignation ?? '—',
          record.newDesignation,
          record.reportingManager ? `${record.reportingManager.firstName} ${record.reportingManager.lastName}` : '—',
        ]),
      };
    case 'INCREMENT':
      return {
        title: 'Increment Report',
        description: 'Salary increment records and their effective salary changes.',
        columns: ['Employee', 'Increment Date', 'Old Salary', 'New Salary', 'Increment %', 'Approved By'],
        rows: increments.map((record) => {
          const oldSalary = Number(record.currentBasicSalary);
          const newSalary = Number(record.newBasicSalary);
          const incrementPct = oldSalary > 0 ? ((newSalary - oldSalary) / oldSalary) * 100 : 0;
          return [
            `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
            formatDate(record.effectiveDate),
            formatMoney(oldSalary),
            formatMoney(newSalary),
            `${incrementPct.toFixed(2)}%`,
            incrementApproverLabel(record),
          ];
        }),
      };
    case 'RESIGNATION':
      return {
        title: 'Resignation Report',
        description: 'Voluntary, mutual, and retirement resignations tracked through the resignation workflow.',
        columns: ['Employee', 'Resignation Date', 'Last Working Day', 'Reason', 'Status'],
        rows: resignations.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          formatDate(record.resignationDate),
          formatDate(record.lastWorkingDate),
          record.reason,
          record.status,
        ]),
      };
    case 'TERMINATION':
      return {
        title: 'Termination Report',
        description: 'Employees whose master employment status is marked terminated, with last working date if available.',
        columns: ['Employee', 'Department', 'Designation', 'Employment Type', 'Termination Date', 'Status'],
        rows: terminations.map((record) => [
          `${record.code} · ${record.firstName} ${record.lastName}`,
          record.department ?? '—',
          record.designation ?? '—',
          record.employmentType ?? '—',
          formatDate(record.leftAt),
          record.status,
        ]),
      };
    case 'EXIT_CLEARANCE':
      return {
        title: 'Exit Clearance Report',
        description: 'Exit clearance records and completion progress for separation workflows.',
        columns: ['Employee', 'Clearance No', 'Last Working Date', 'Exit Type', 'Status', 'Completed Date'],
        rows: exitClearances.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          record.clearanceNumber,
          formatDate(record.lastWorkingDate),
          record.exitType,
          record.status,
          formatDate(record.completedAt),
        ]),
      };
    case 'FINAL_SETTLEMENT':
      return {
        title: 'Final Settlement Report',
        description: 'Final settlement records created from completed separation workflows.',
        columns: ['Employee', 'Settlement No', 'Last Working Date', 'Net Settlement', 'Status', 'Payment Date'],
        rows: settlements.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          record.no,
          formatDate(record.lastWorkingDate),
          formatMoney(Number(record.netSettlement)),
          record.status,
          formatDate(record.paymentDate),
        ]),
      };
    case 'EMPLOYEE_MOVEMENT':
      return {
        title: 'Employee Movement Report',
        description: 'Combined employee lifecycle movements across confirmation, transfer, promotion, increment, and separation events.',
        columns: ['Lifecycle Type', 'Employee', 'Department', 'Designation', 'Event Date', 'Detail', 'Status'],
        rows: movementRows.map((row) => [
          row.type,
          `${row.employeeCode} · ${row.employeeName}`,
          row.department,
          row.designation,
          row.eventDate,
          row.detail,
          row.status,
        ]),
      };
    case 'LIFECYCLE_SUMMARY':
    default:
      return {
        title: 'Lifecycle Summary Report',
        description: 'High-level summary across all employee lifecycle modules in the selected scope.',
        columns: ['Metric', 'Count'],
        rows: [
          ['Confirmations', confirmations.length],
          ['Transfers', transfers.length],
          ['Promotions', promotions.length],
          ['Increments', increments.length],
          ['Resignations', resignations.length],
          ['Terminations', terminations.length],
          ['Exit Clearances', exitClearances.length],
          ['Final Settlements', settlements.length],
        ],
      };
  }
}

export const lifecycleReportsService = {
  async getReportCenter(session: AppSession | null, filters: LifecycleReportFilters = {}) {
    await authorize(session, 'hr:read');

    const reportType = filters.reportType ?? 'LIFECYCLE_SUMMARY';
    const effectiveFrom = filters.effectiveFrom ?? '';
    const effectiveTo = filters.effectiveTo ?? '';
    const lastWorkingFrom = filters.lastWorkingFrom ?? '';
    const lastWorkingTo = filters.lastWorkingTo ?? '';
    const effectiveFromDate = normalizeDateStart(filters.effectiveFrom);
    const effectiveToDate = normalizeDateEnd(filters.effectiveTo);
    const lastWorkingFromDate = normalizeDateStart(filters.lastWorkingFrom);
    const lastWorkingToDate = normalizeDateEnd(filters.lastWorkingTo);

    const [branches, employees, confirmationAvailable, incrementAvailable, promotionAvailable, resignationAvailable] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.employee.findMany({
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          branchId: true,
          department: true,
          designation: true,
          employmentType: true,
          status: true,
          leftAt: true,
          joinedAt: true,
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      isConfirmationTableAvailable(),
      isIncrementTableAvailable(),
      isPromotionTableAvailable(),
      isResignationTableAvailable(),
    ]);

    const [
      confirmationsRaw,
      incrementsRaw,
      promotionsRaw,
      transfersRaw,
      resignationsRaw,
      exitClearancesRaw,
      settlementsRaw,
    ] = await Promise.all([
      confirmationAvailable
        ? prisma.employeeConfirmation.findMany({
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
                  joinedAt: true,
                  branchId: true,
                },
              },
            },
            orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([] as ConfirmationRecord[]),
      incrementAvailable
        ? prisma.employeeIncrement.findMany({
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
                },
              },
              reportingManager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([] as IncrementRecord[]),
      promotionAvailable
        ? prisma.employeePromotion.findMany({
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
                },
              },
              reportingManager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([] as PromotionRecord[]),
      prisma.employeeTransfer.findMany({
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
            },
          },
          branch: { select: { id: true, code: true, name: true } },
          newBranch: { select: { id: true, code: true, name: true } },
          tempBranch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      }),
      resignationAvailable
        ? prisma.employeeResignation.findMany({
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
                },
              },
            },
            orderBy: [{ lastWorkingDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([] as ResignationRecord[]),
      resignationAvailable
        ? prisma.employeeExitClearance.findMany({
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
                },
              },
            },
            orderBy: [{ lastWorkingDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([] as ExitClearanceRecord[]),
      prisma.finalSettlement.findMany({
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
            },
          },
        },
        orderBy: [{ lastWorkingDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const confirmations = confirmationsRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => matchesEffectiveDate(record.effectiveDate, effectiveFromDate, effectiveToDate));

    const increments = incrementsRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => matchesEffectiveDate(record.effectiveDate, effectiveFromDate, effectiveToDate));

    const promotions = promotionsRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => matchesEffectiveDate(record.effectiveDate, effectiveFromDate, effectiveToDate));

    const transfers = transfersRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => matchesEffectiveDate(record.effectiveDate ?? record.startDate, effectiveFromDate, effectiveToDate));

    const resignations = resignationsRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => matchesEffectiveDate(record.resignationDate, effectiveFromDate, effectiveToDate))
      .filter((record) => matchesLastWorkingDate(record.lastWorkingDate, lastWorkingFromDate, lastWorkingToDate));

    const terminations = employees
      .filter((employee) => employee.status === 'TERMINATED')
      .filter((employee) => matchesEmployeeLike(employee, filters))
      .filter((employee) => matchesStatus(employee.status, filters))
      .filter((employee) => matchesLastWorkingDate(employee.leftAt, lastWorkingFromDate, lastWorkingToDate));

    const exitClearances = exitClearancesRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => (!filters.lifecycleType || filters.lifecycleType === 'EXIT_CLEARANCE' || record.exitType === filters.lifecycleType))
      .filter((record) => matchesLastWorkingDate(record.lastWorkingDate, lastWorkingFromDate, lastWorkingToDate));

    const settlements = settlementsRaw
      .filter((record) => matchesEmployeeLike(record.employee, filters))
      .filter((record) => matchesStatus(record.status, filters))
      .filter((record) => matchesLastWorkingDate(record.lastWorkingDate, lastWorkingFromDate, lastWorkingToDate));

    const report = buildReportRows({
      reportType,
      confirmations,
      transfers,
      promotions,
      increments,
      resignations,
      terminations,
      exitClearances,
      settlements,
      lifecycleType: filters.lifecycleType ?? '',
    });

    return {
      filters: {
        reportType,
        branchId: filters.branchId ?? '',
        department: filters.department ?? '',
        designation: filters.designation ?? '',
        employmentType: filters.employmentType ?? '',
        employeeId: filters.employeeId ?? '',
        lifecycleType: filters.lifecycleType ?? '',
        status: filters.status ?? '',
        effectiveFrom,
        effectiveTo,
        lastWorkingFrom,
        lastWorkingTo,
      },
      options: {
        branches,
        departments: Array.from(new Set(employees.map((employee) => employee.department).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        designations: Array.from(new Set(employees.map((employee) => employee.designation).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        employmentTypes: Array.from(new Set(employees.map((employee) => employee.employmentType).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        employees: employees.map((employee) => ({ value: employee.id, label: `${employee.code} · ${employee.firstName} ${employee.lastName}` })),
        lifecycleTypes: ['CONFIRMATION', 'TRANSFER', 'PROMOTION', 'INCREMENT', 'RESIGNATION', 'TERMINATION', 'EXIT_CLEARANCE', 'FINAL_SETTLEMENT'],
        statuses: Array.from(
          new Set([
            ...confirmationsRaw.map((record) => record.status),
            ...incrementsRaw.map((record) => record.status),
            ...promotionsRaw.map((record) => record.status),
            ...transfersRaw.map((record) => record.status),
            ...resignationsRaw.map((record) => record.status),
            ...exitClearancesRaw.map((record) => record.status),
            ...settlementsRaw.map((record) => record.status),
            'TERMINATED',
          ]),
        ).sort((a, b) => a.localeCompare(b)),
      },
      dashboard: {
        confirmations: confirmations.length,
        transfers: transfers.length,
        promotions: promotions.length,
        increments: increments.length,
        resignations: resignations.length,
        terminations: terminations.length,
        finalSettlements: settlements.length,
      },
      report,
      meta: {
        rowCount: report.rows.length,
      },
    };
  },
};
