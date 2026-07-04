import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { leaveTypesService } from '@/server/services/leave-types.service';
import {
  LEGACY_LEAVE_ENTITLEMENTS,
  resolveLeavePolicyForEmployee,
} from './leave-policies.service';
import type { LeaveBalanceAdjustmentInput } from '@/server/validators/leave-balance';
import { LEAVE_BALANCE_ADJUSTMENT_TYPES } from '@/server/validators/leave-balance';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const NEGATIVE_ADJUSTMENT_TYPES = new Set<string>();
const POSITIVE_ADJUSTMENT_TYPES = new Set(['CARRY_FORWARD_CORRECTION', 'OPENING_BALANCE_CORRECTION']);
const TRACKED_REQUEST_STATUSES = ['APPROVED', 'PENDING_MANAGER', 'PENDING_HR'] as const;

export type LeaveBalanceStatus = 'ACTIVE' | 'LOW_BALANCE' | 'ZERO_BALANCE' | 'NEGATIVE_BALANCE';

export type BalanceRow = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  joiningDate: string;
  leavePolicy: string;
  leaveYear: number;
  leaveType: string;
  isUnlimited: boolean;
  openingBalance: number;
  entitledDays: number;
  carryForwardDays: number;
  approvedTakenDays: number;
  pendingLeaveDays: number;
  manualAdjustmentDays: number;
  encashedDays: number;
  availableBalance: number;
  expiredLeaveDays: number;
  encashableDays: number;
  status: LeaveBalanceStatus;
  employeeStatus: string;
};

export type EmployeeBalanceSummary = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  leavePolicy: string;
  leaveYear: number;
  leaveTypesCount: number;
  totalEntitledDays: number;
  totalApprovedTakenDays: number;
  totalPendingLeaveDays: number;
  totalCarryForwardDays: number;
  totalEncashedDays: number;
  totalAvailableBalance: number;
  hasUnlimitedBalance: boolean;
  status: LeaveBalanceStatus;
};

export type LeaveBalanceAdjustmentRecord = {
  id: string;
  adjustmentNo: string;
  employeeId: string;
  leaveType: string;
  leaveYear: number;
  adjustmentType: string;
  days: number;
  reason: string;
  attachmentPath: string | null;
  effectiveDate: string;
  adjustedById: string | null;
  adjustedByName: string | null;
  createdAt: string;
  employee: {
    id: string;
    code: string;
    name: string;
    branchName: string;
  };
};

export type LeaveHistoryItem = {
  id: string;
  leaveRequestNo: string;
  date: string;
  fromDate: string;
  toDate: string;
  leaveType: string;
  days: number;
  status: string;
  balanceAfter: number | null;
};

export type BalanceTransactionItem = {
  id: string;
  date: string;
  leaveType: string;
  action: string;
  days: number;
  updatedBy: string;
  remarks: string;
  balanceAfter: number | null;
};

export type EmployeeBalanceDetail = {
  employee: {
    id: string;
    code: string;
    name: string;
    branchName: string;
    department: string | null;
    designation: string | null;
    employmentType: string | null;
    joiningDate: string;
    status: string;
  };
  leavePolicy: string;
  year: number;
  rows: BalanceRow[];
  leaveHistory: LeaveHistoryItem[];
  transactionLog: BalanceTransactionItem[];
  adjustments: LeaveBalanceAdjustmentRecord[];
};

type BalanceFilters = {
  year?: number;
  branchId?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  leaveType?: string;
  balanceStatus?: string;
  q?: string;
};

type EmployeeRecord = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  branchId: string;
  branch: { name: string };
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  joinedAt: Date;
  status: string;
};

type RequestRecord = {
  id: string;
  leaveRequestNo: string;
  employeeId: string;
  type: string;
  status: string;
  days: Prisma.Decimal;
  fromDate: Date;
  toDate: Date;
  createdAt: Date;
  managerId: string | null;
  hrId: string | null;
};

type AdjustmentRecord = Prisma.LeaveBalanceAdjustmentGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        branch: { select: { id: true; name: true } };
      };
    };
  };
}>;

type AdjustmentSummary = {
  carryForwardDays: number;
  openingBalanceCorrectionDays: number;
  manualAdjustmentDays: number;
  encashedDays: number;
};

type LedgerEntry = {
  id: string;
  employeeId: string;
  leaveType: string;
  date: Date;
  sortOrder: number;
  action: string;
  days: number;
  updatedBy: string;
  remarks: string;
  includeInHistory: boolean;
  historyStatus?: string;
  leaveRequestNo?: string;
  fromDate?: Date;
  toDate?: Date;
};

function normalizeAdjustmentDays(type: LeaveBalanceAdjustmentInput['adjustmentType'], value: number) {
  if (NEGATIVE_ADJUSTMENT_TYPES.has(type)) return -Math.abs(value);
  if (POSITIVE_ADJUSTMENT_TYPES.has(type)) return Math.abs(value);
  return value;
}

function getBalanceStatus(availableBalance: number): LeaveBalanceStatus {
  if (availableBalance < 0) return 'NEGATIVE_BALANCE';
  if (availableBalance === 0) return 'ZERO_BALANCE';
  if (availableBalance <= 2) return 'LOW_BALANCE';
  return 'ACTIVE';
}

function getStatusRank(status: LeaveBalanceStatus) {
  if (status === 'NEGATIVE_BALANCE') return 4;
  if (status === 'ZERO_BALANCE') return 3;
  if (status === 'LOW_BALANCE') return 2;
  return 1;
}

function summarizeAdjustmentDays(adjustments: Array<{ adjustmentType: string; days: Prisma.Decimal }>): AdjustmentSummary {
  let carryForwardDays = 0;
  let openingBalanceCorrectionDays = 0;
  let manualAdjustmentDays = 0;
  let encashedDays = 0;

  for (const adjustment of adjustments) {
    const days = Number(adjustment.days);

    if (adjustment.adjustmentType === 'CARRY_FORWARD_CORRECTION') {
      carryForwardDays += days;
      continue;
    }

    if (adjustment.adjustmentType === 'OPENING_BALANCE_CORRECTION') {
      openingBalanceCorrectionDays += days;
      continue;
    }



    manualAdjustmentDays += days;
  }

  return { carryForwardDays, openingBalanceCorrectionDays, manualAdjustmentDays, encashedDays };
}

function buildAdjustmentInclude() {
  return {
    employee: {
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        branch: { select: { id: true, name: true } },
      },
    },
  } as const;
}

function serializeAdjustment(record: AdjustmentRecord, actorNameMap: Map<string, string>): LeaveBalanceAdjustmentRecord {
  return {
    id: record.id,
    adjustmentNo: record.adjustmentNo,
    employeeId: record.employeeId,
    leaveType: record.leaveType,
    leaveYear: record.leaveYear,
    adjustmentType: record.adjustmentType,
    days: Number(record.days),
    reason: record.reason,
    attachmentPath: record.attachmentPath,
    effectiveDate: record.effectiveDate.toISOString(),
    adjustedById: record.adjustedById,
    adjustedByName: record.adjustedById ? actorNameMap.get(record.adjustedById) ?? null : null,
    createdAt: record.createdAt.toISOString(),
    employee: {
      id: record.employee.id,
      code: record.employee.code,
      name: `${record.employee.firstName} ${record.employee.lastName}`,
      branchName: record.employee.branch.name,
    },
  };
}

async function nextAdjustmentNumber(year: number) {
  const prefix = `LBA-${year}-`;
  const last = await prisma.leaveBalanceAdjustment.findFirst({
    where: { adjustmentNo: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { adjustmentNo: true },
  });
  const seq = last ? parseInt(last.adjustmentNo.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(seq + 1).padStart(4, '0')}`;
}

async function resolveActorNames(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

async function loadBalanceDataset(filters: BalanceFilters = {}) {
  const year = filters.year ?? new Date().getUTCFullYear();
  const asOfDate = new Date(Date.UTC(year, 0, 1));
  const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const q = filters.q?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ['ACTIVE', 'ON_LEAVE'] },
      branchId: filters.branchId || undefined,
      department: filters.department || undefined,
      designation: filters.designation || undefined,
      id: filters.employeeId || undefined,
      OR: q
        ? [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ]
        : undefined,
    },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      branchId: true,
      branch: { select: { name: true } },
      department: true,
      designation: true,
      employmentType: true,
      joinedAt: true,
      status: true,
    },
    orderBy: [{ code: 'asc' }],
  });

  if (employees.length === 0) {
    return {
      year,
      employees: [] as EmployeeRecord[],
      rows: [] as BalanceRow[],
      requests: [] as RequestRecord[],
      adjustments: [] as AdjustmentRecord[],
      policiesByEmployee: new Map<string, Awaited<ReturnType<typeof resolveLeavePolicyForEmployee>>>(),
      actorNameMap: new Map<string, string>(),
    };
  }

  const policiesByEmployee = new Map(
    await Promise.all(
      employees.map(async (employee) => [employee.id, await resolveLeavePolicyForEmployee(employee.id, asOfDate)] as const),
    ),
  );
  const activeLeaveTypes = await leaveTypesService.listActivePublic();
  const activeLeaveTypeMap = new Map(activeLeaveTypes.map((leaveType) => [leaveType.code, leaveType]));

  const leaveTypes = filters.leaveType
    ? [filters.leaveType]
    : Array.from(
        new Set(
          employees.flatMap((employee) => {
            const policy = policiesByEmployee.get(employee.id);
            if (!policy) return activeLeaveTypes.map((leaveType) => leaveType.code);
            return policy.rules.map((rule) => rule.leaveType);
          }),
        ),
      ).sort();

  const employeeIds = employees.map((employee) => employee.id);
  const adjustmentInclude = buildAdjustmentInclude();
  const [requests, adjustments] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        type: filters.leaveType || undefined,
        fromDate: { gte: asOfDate },
        toDate: { lte: endOfYear },
        status: { in: [...TRACKED_REQUEST_STATUSES] },
      },
      select: {
        id: true,
        leaveRequestNo: true,
        employeeId: true,
        type: true,
        status: true,
        days: true,
        fromDate: true,
        toDate: true,
        createdAt: true,
        managerId: true,
        hrId: true,
      },
      orderBy: [{ fromDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.leaveBalanceAdjustment.findMany({
      where: {
        employeeId: { in: employeeIds },
        leaveYear: year,
        leaveType: filters.leaveType || undefined,
      },
      include: adjustmentInclude,
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const requestMap = new Map<string, { approvedTakenDays: number; pendingLeaveDays: number }>();
  for (const request of requests) {
    const key = `${request.employeeId}:${request.type}`;
    const current = requestMap.get(key) ?? { approvedTakenDays: 0, pendingLeaveDays: 0 };

    if (request.status === 'APPROVED') current.approvedTakenDays += Number(request.days);
    if (request.status === 'PENDING_MANAGER' || request.status === 'PENDING_HR') {
      current.pendingLeaveDays += Number(request.days);
    }

    requestMap.set(key, current);
  }

  const adjustmentMap = new Map<string, Array<{ adjustmentType: string; days: Prisma.Decimal }>>();
  for (const adjustment of adjustments) {
    const key = `${adjustment.employeeId}:${adjustment.leaveType}`;
    const current = adjustmentMap.get(key) ?? [];
    current.push({ adjustmentType: adjustment.adjustmentType, days: adjustment.days });
    adjustmentMap.set(key, current);
  }

  const rows: BalanceRow[] = [];

  for (const employee of employees) {
    const resolvedPolicy = policiesByEmployee.get(employee.id);
    for (const leaveType of leaveTypes) {
      const key = `${employee.id}:${leaveType}`;
      const requestSummary = requestMap.get(key) ?? { approvedTakenDays: 0, pendingLeaveDays: 0 };
      const adjustmentSummary = summarizeAdjustmentDays(adjustmentMap.get(key) ?? []);
      const rule =
        resolvedPolicy?.rules.find((item) => item.leaveType === leaveType && item.status === 'ACTIVE') ?? null;
      const leaveTypeMaster = activeLeaveTypeMap.get(leaveType) ?? null;
      if (!rule && !leaveTypeMaster && !LEGACY_LEAVE_ENTITLEMENTS[leaveType]) continue;

      const isUnlimited = rule?.isUnlimited ?? false;
      const entitledDays = isUnlimited
        ? 0
        : rule?.entitledDays ?? leaveTypeMaster?.annualEntitlement ?? LEGACY_LEAVE_ENTITLEMENTS[leaveType] ?? 0;
      const openingBalance = entitledDays + adjustmentSummary.openingBalanceCorrectionDays;
      const calculatedAvailable =
        openingBalance +
        adjustmentSummary.carryForwardDays -
        requestSummary.approvedTakenDays -
        requestSummary.pendingLeaveDays -
        adjustmentSummary.encashedDays;
      const availableBalance = isUnlimited ? Number.MAX_SAFE_INTEGER : calculatedAvailable;
      const allowNegativeBalance = rule?.allowNegativeBalance ?? leaveTypeMaster?.allowNegativeBalance ?? false;
      const safeAvailable = allowNegativeBalance || isUnlimited ? availableBalance : Math.max(0, availableBalance);
      const status = getBalanceStatus(safeAvailable);

      if (filters.balanceStatus && filters.balanceStatus !== status) continue;

      const encashableDays = 0;

      rows.push({
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        branchId: employee.branchId,
        branchName: employee.branch.name,
        department: employee.department,
        designation: employee.designation,
        employmentType: employee.employmentType,
        joiningDate: employee.joinedAt.toISOString(),
        leavePolicy: resolvedPolicy?.policyName ?? 'Standard Leave Policy',
        leaveYear: year,
        leaveType,
        isUnlimited,
        openingBalance,
        entitledDays,
        carryForwardDays: adjustmentSummary.carryForwardDays,
        approvedTakenDays: requestSummary.approvedTakenDays,
        pendingLeaveDays: requestSummary.pendingLeaveDays,
        manualAdjustmentDays: adjustmentSummary.manualAdjustmentDays,
        encashedDays: adjustmentSummary.encashedDays,
        availableBalance: safeAvailable,
        expiredLeaveDays: 0,
        encashableDays,
        status,
        employeeStatus: employee.status,
      });
    }
  }

  const actorIds = Array.from(
    new Set([
      ...adjustments.map((adjustment) => adjustment.adjustedById).filter((value): value is string => Boolean(value)),
      ...requests.map((request) => request.hrId).filter((value): value is string => Boolean(value)),
      ...requests.map((request) => request.managerId).filter((value): value is string => Boolean(value)),
    ]),
  );
  const actorNameMap = await resolveActorNames(actorIds);

  return { year, employees, rows, requests, adjustments, policiesByEmployee, actorNameMap };
}

function buildEmployeeSummaries(rows: BalanceRow[]) {
  const summaryMap = new Map<string, EmployeeBalanceSummary>();

  for (const row of rows) {
    const current = summaryMap.get(row.employeeId);
    const nextStatus =
      current == null || getStatusRank(row.status) > getStatusRank(current.status) ? row.status : current.status;

    if (!current) {
      summaryMap.set(row.employeeId, {
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        branchName: row.branchName,
        department: row.department,
        designation: row.designation,
        employmentType: row.employmentType,
        leavePolicy: row.leavePolicy,
        leaveYear: row.leaveYear,
        leaveTypesCount: 1,
        totalEntitledDays: row.openingBalance,
        totalApprovedTakenDays: row.approvedTakenDays,
        totalPendingLeaveDays: row.pendingLeaveDays,
        totalCarryForwardDays: row.carryForwardDays,
        totalEncashedDays: row.encashedDays,
        totalAvailableBalance: row.isUnlimited ? 0 : row.availableBalance,
        hasUnlimitedBalance: row.isUnlimited,
        status: row.status,
      });
      continue;
    }

    current.leaveTypesCount += 1;
    current.totalEntitledDays += row.openingBalance;
    current.totalApprovedTakenDays += row.approvedTakenDays;
    current.totalPendingLeaveDays += row.pendingLeaveDays;
    current.totalCarryForwardDays += row.carryForwardDays;
    current.totalEncashedDays += row.encashedDays;
    current.totalAvailableBalance += row.isUnlimited ? 0 : row.availableBalance;
    current.hasUnlimitedBalance = current.hasUnlimitedBalance || row.isUnlimited;
    current.status = nextStatus;
  }

  return Array.from(summaryMap.values()).sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
}

function buildLedgerEntries(
  employeeId: string,
  rows: BalanceRow[],
  requests: RequestRecord[],
  adjustments: AdjustmentRecord[],
  actorNameMap: Map<string, string>,
) {
  const entries: LedgerEntry[] = [];

  for (const row of rows) {
    entries.push({
      id: `initial-${employeeId}-${row.leaveType}`,
      employeeId,
      leaveType: row.leaveType,
      date: new Date(Date.UTC(row.leaveYear, 0, 1)),
      sortOrder: 10,
      action: 'Policy Assigned',
      days: row.entitledDays,
      updatedBy: 'System',
      remarks: `Initial allocation from ${row.leavePolicy}`,
      includeInHistory: false,
    });
  }

  for (const adjustment of adjustments) {
    if (adjustment.employeeId !== employeeId) continue;

    const actorName = adjustment.adjustedById
      ? actorNameMap.get(adjustment.adjustedById) ?? 'HR'
      : 'System';
    const normalizedDays = Number(adjustment.days);
    let action = adjustment.adjustmentType.replaceAll('_', ' ');

    if (adjustment.adjustmentType === 'CARRY_FORWARD_CORRECTION') action = 'Carry Forward';
    if (adjustment.adjustmentType === 'OPENING_BALANCE_CORRECTION') action = 'Opening Balance';


    entries.push({
      id: adjustment.id,
      employeeId,
      leaveType: adjustment.leaveType,
      date: adjustment.effectiveDate,
      sortOrder: 20,
      action,
      days: normalizedDays,
      updatedBy: actorName,
      remarks: adjustment.reason,
      includeInHistory: false,
    });
  }

  for (const request of requests) {
    if (request.employeeId !== employeeId) continue;

    const updatedBy =
      request.status === 'APPROVED'
        ? request.hrId
          ? actorNameMap.get(request.hrId) ?? 'HR'
          : request.managerId
            ? actorNameMap.get(request.managerId) ?? 'Manager'
            : 'HR Workflow'
        : 'Pending Workflow';

    entries.push({
      id: request.id,
      employeeId,
      leaveType: request.type,
      date: request.fromDate,
      sortOrder: 30,
      action: request.status === 'APPROVED' ? 'Leave Approved' : 'Leave Pending',
      days: -Number(request.days),
      updatedBy,
      remarks: request.leaveRequestNo,
      includeInHistory: true,
      historyStatus: request.status,
      leaveRequestNo: request.leaveRequestNo,
      fromDate: request.fromDate,
      toDate: request.toDate,
    });
  }

  entries.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    const orderDiff = a.sortOrder - b.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    return a.id.localeCompare(b.id);
  });

  return entries;
}

function buildEmployeeDetail(
  employee: EmployeeRecord,
  rows: BalanceRow[],
  requests: RequestRecord[],
  adjustments: AdjustmentRecord[],
  actorNameMap: Map<string, string>,
  year: number,
) {
  if (rows.length === 0) {
    throw new NotFoundError('No leave balance rows found for this employee.');
  }

  const ledger = buildLedgerEntries(employee.id, rows, requests, adjustments, actorNameMap);
  const runningBalance = new Map(rows.map((row) => [row.leaveType, row.isUnlimited ? null : 0]));
  const leaveHistory: LeaveHistoryItem[] = [];
  const transactionLog: BalanceTransactionItem[] = [];

  for (const entry of ledger) {
    const currentBalance = runningBalance.get(entry.leaveType);
    const nextBalance = currentBalance == null ? null : currentBalance + entry.days;
    if (currentBalance != null) runningBalance.set(entry.leaveType, nextBalance);

    transactionLog.push({
      id: entry.id,
      date: entry.date.toISOString(),
      leaveType: entry.leaveType,
      action: entry.action,
      days: entry.days,
      updatedBy: entry.updatedBy,
      remarks: entry.remarks,
      balanceAfter: nextBalance,
    });

    if (!entry.includeInHistory) continue;
    leaveHistory.push({
      id: entry.id,
      leaveRequestNo: entry.leaveRequestNo ?? '',
      date: entry.date.toISOString(),
      fromDate: entry.fromDate?.toISOString() ?? entry.date.toISOString(),
      toDate: entry.toDate?.toISOString() ?? entry.date.toISOString(),
      leaveType: entry.leaveType,
      days: Math.abs(entry.days),
      status: entry.historyStatus ?? 'PENDING',
      balanceAfter: nextBalance,
    });
  }

  const adjustmentRecords = adjustments
    .filter((adjustment) => adjustment.employeeId === employee.id)
    .map((adjustment) => serializeAdjustment(adjustment, actorNameMap));

  return {
    employee: {
      id: employee.id,
      code: employee.code,
      name: `${employee.firstName} ${employee.lastName}`,
      branchName: employee.branch.name,
      department: employee.department,
      designation: employee.designation,
      employmentType: employee.employmentType,
      joiningDate: employee.joinedAt.toISOString(),
      status: employee.status,
    },
    leavePolicy: rows[0]?.leavePolicy ?? 'Standard Leave Policy',
    year,
    rows,
    leaveHistory,
    transactionLog,
    adjustments: adjustmentRecords,
  };
}

export const leaveBalanceService = {
  async listBalances(session: AppSession | null, filters: BalanceFilters = {}) {
    await authorize(session, 'hr:read');
    const dataset = await loadBalanceDataset(filters);
    return dataset.rows;
  },

  async listEmployeeSummaries(session: AppSession | null, filters: BalanceFilters = {}) {
    await authorize(session, 'hr:read');
    const dataset = await loadBalanceDataset(filters);
    return buildEmployeeSummaries(dataset.rows);
  },

  async getEmployeeBalanceDetail(session: AppSession | null, employeeId: string, year?: number) {
    await authorize(session, 'hr:read');
    const dataset = await loadBalanceDataset({ employeeId, year });
    const employee = dataset.employees.find((item) => item.id === employeeId);
    if (!employee) throw new NotFoundError('Employee not found');
    const rows = dataset.rows.filter((row) => row.employeeId === employeeId);
    return buildEmployeeDetail(employee, rows, dataset.requests, dataset.adjustments, dataset.actorNameMap, dataset.year);
  },

  async getBalancePreview(session: AppSession | null, employeeId: string, year: number) {
    const rows = await this.listBalances(session, { employeeId, year });
    return Object.fromEntries(
      rows.map((row) => [
        row.leaveType,
        {
          entitled: row.openingBalance,
          used: row.approvedTakenDays,
          pending: row.pendingLeaveDays,
          carryForward: row.carryForwardDays,
          encashed: row.encashedDays,
          available: row.availableBalance,
          isUnlimited: row.isUnlimited,
          status: row.status,
        },
      ]),
    );
  },

  async listAdjustmentHistory(
    session: AppSession | null,
    filters: {
      year?: number;
      branchId?: string;
      employeeId?: string;
      leaveType?: string;
    } = {},
  ) {
    await authorize(session, 'hr:read');

    const adjustmentInclude = buildAdjustmentInclude();
    const records = await prisma.leaveBalanceAdjustment.findMany({
      where: {
        leaveYear: filters.year,
        employeeId: filters.employeeId || undefined,
        leaveType: filters.leaveType || undefined,
        employee: {
          branchId: filters.branchId || undefined,
        },
      },
      include: adjustmentInclude,
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    const actorNameMap = await resolveActorNames(
      Array.from(new Set(records.map((record) => record.adjustedById).filter((value): value is string => Boolean(value)))),
    );

    return records.map((record) => serializeAdjustment(record, actorNameMap));
  },

  async createAdjustment(session: AppSession | null, input: LeaveBalanceAdjustmentInput) {
    const actor = await authorize(session, 'hr:write');
    await leaveTypesService.assertCodeExists(input.leaveType);

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!employee) throw new NotFoundError('Employee not found');

    const normalizedDays = normalizeAdjustmentDays(input.adjustmentType, input.adjustmentDays);
    const policy = await resolveLeavePolicyForEmployee(input.employeeId, new Date(Date.UTC(input.leaveYear, 0, 1)));
    const rule = policy.rules.find((item) => item.leaveType === input.leaveType && item.status === 'ACTIVE');
    const leaveTypeMaster = (await leaveTypesService.listActivePublic()).find((item) => item.code === input.leaveType) ?? null;



    if (input.adjustmentType === 'CARRY_FORWARD_CORRECTION' && rule?.maxCarryForwardDays != null) {
      const existing = await prisma.leaveBalanceAdjustment.aggregate({
        where: {
          employeeId: input.employeeId,
          leaveType: input.leaveType,
          leaveYear: input.leaveYear,
          adjustmentType: 'CARRY_FORWARD_CORRECTION',
        },
        _sum: { days: true },
      });
      const nextCarryForward = Number(existing._sum.days ?? 0) + normalizedDays;
      if (nextCarryForward > rule.maxCarryForwardDays) {
        throw new ValidationError(
          `Carry forward cannot exceed ${rule.maxCarryForwardDays} days for ${input.leaveType.replaceAll('_', ' ')}.`,
        );
      }
    }

    const adjustmentNo = await nextAdjustmentNumber(input.leaveYear);
    const adjustmentInclude = buildAdjustmentInclude();

    return prisma.$transaction(async (tx) => {
      const record = await tx.leaveBalanceAdjustment.create({
        data: {
          adjustmentNo,
          employeeId: input.employeeId,
          leaveType: input.leaveType,
          leaveYear: input.leaveYear,
          adjustmentType: input.adjustmentType,
          days: D(normalizedDays),
          reason: input.reason,
          attachmentPath: input.attachmentPath || null,
          effectiveDate: new Date(Date.UTC(input.leaveYear, 0, 1)),
          adjustedById: actor.userId,
        },
        include: adjustmentInclude,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: employee.branchId,
          module: 'hr',
          action: 'leave-balance-adjustment-create',
          entityType: 'LeaveBalanceAdjustment',
          entityId: record.id,
          after: {
            adjustmentNo,
            employeeId: input.employeeId,
            leaveType: input.leaveType,
            leaveYear: input.leaveYear,
            adjustmentType: input.adjustmentType,
            days: normalizedDays,
          },
        },
        tx,
      );

      return serializeAdjustment(record, new Map([[actor.userId, actor.name ?? 'HR']]));
    });
  },

  adjustmentTypes: [...LEAVE_BALANCE_ADJUSTMENT_TYPES],
};
