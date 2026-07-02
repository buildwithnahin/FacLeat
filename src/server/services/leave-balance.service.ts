import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError } from '@/lib/errors';
import {
  LEGACY_LEAVE_ENTITLEMENTS,
  resolveLeavePolicyForEmployee,
} from './leave-policies.service';
import type { LeaveBalanceAdjustmentInput } from '@/server/validators/leave-balance';
import { LEAVE_BALANCE_ADJUSTMENT_TYPES } from '@/server/validators/leave-balance';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const NEGATIVE_ADJUSTMENT_TYPES = new Set(['DEDUCT_LEAVE', 'LEAVE_ENCASHMENT_DEDUCTION']);
const POSITIVE_ADJUSTMENT_TYPES = new Set(['ADD_LEAVE', 'SPECIAL_LEAVE_ADD']);

export type LeaveBalanceStatus = 'ACTIVE' | 'LOW_BALANCE' | 'ZERO_BALANCE' | 'NEGATIVE_BALANCE';

type BalanceRow = {
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
  openingBalance: number;
  entitledDays: number;
  carryForwardDays: number;
  approvedTakenDays: number;
  pendingLeaveDays: number;
  manualAdjustmentDays: number;
  availableBalance: number;
  expiredLeaveDays: number;
  encashableDays: number;
  status: LeaveBalanceStatus;
  employeeStatus: string;
};

const adjustmentInclude = {
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

type AdjustmentRecord = Prisma.LeaveBalanceAdjustmentGetPayload<{ include: typeof adjustmentInclude }>;

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

function groupAdjustmentDays(adjustments: Array<{ adjustmentType: string; days: Prisma.Decimal }>) {
  let carryForwardDays = 0;
  let openingBalanceCorrectionDays = 0;
  let manualAdjustmentDays = 0;

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

  return { carryForwardDays, openingBalanceCorrectionDays, manualAdjustmentDays };
}

function serializeAdjustment(record: AdjustmentRecord) {
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

export const leaveBalanceService = {
  async listBalances(
    session: AppSession | null,
    filters: {
      year?: number;
      branchId?: string;
      department?: string;
      designation?: string;
      employeeId?: string;
      leaveType?: string;
      balanceStatus?: string;
    } = {},
  ) {
    await authorize(session, 'hr:read');

    const year = filters.year ?? new Date().getUTCFullYear();
    const asOfDate = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const employees = await prisma.employee.findMany({
      where: {
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
        branchId: filters.branchId || undefined,
        department: filters.department || undefined,
        designation: filters.designation || undefined,
        id: filters.employeeId || undefined,
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

    if (employees.length === 0) return [] as BalanceRow[];

    const policiesByEmployee = new Map(
      await Promise.all(
        employees.map(async (employee) => [employee.id, await resolveLeavePolicyForEmployee(employee.id, asOfDate)] as const),
      ),
    );
    const leaveTypes = filters.leaveType
      ? [filters.leaveType]
      : Array.from(
          new Set(
            employees.flatMap((employee) => {
              const policy = policiesByEmployee.get(employee.id);
              if (!policy) return Object.keys(LEGACY_LEAVE_ENTITLEMENTS);
              return policy.rules.map((rule) => rule.leaveType);
            }),
          ),
        ).sort();

    const employeeIds = employees.map((employee) => employee.id);
    const [requests, adjustments] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          type: filters.leaveType as never || undefined,
          fromDate: { gte: asOfDate },
          toDate: { lte: endOfYear },
          status: { in: ['APPROVED', 'PENDING_MANAGER', 'PENDING_HR'] },
        },
        select: {
          employeeId: true,
          type: true,
          status: true,
          days: true,
        },
      }),
      prisma.leaveBalanceAdjustment.findMany({
        where: {
          employeeId: { in: employeeIds },
          leaveYear: year,
          leaveType: filters.leaveType as never || undefined,
        },
        select: {
          employeeId: true,
          leaveType: true,
          adjustmentType: true,
          days: true,
        },
      }),
    ]);

    const requestMap = new Map<string, { approvedTakenDays: number; pendingLeaveDays: number }>();
    for (const request of requests) {
      const key = `${request.employeeId}:${request.type}`;
      const current = requestMap.get(key) ?? { approvedTakenDays: 0, pendingLeaveDays: 0 };

      if (request.status === 'APPROVED') current.approvedTakenDays += Number(request.days);
      if (['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) current.pendingLeaveDays += Number(request.days);

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
        const adjustmentSummary = groupAdjustmentDays(adjustmentMap.get(key) ?? []);
        const rule =
          resolvedPolicy?.rules.find((item) => item.leaveType === leaveType && item.status === 'ACTIVE') ?? null;
        if (!rule && !LEGACY_LEAVE_ENTITLEMENTS[leaveType]) continue;

        const entitledDays = rule?.isUnlimited ? 0 : rule?.entitledDays ?? LEGACY_LEAVE_ENTITLEMENTS[leaveType] ?? 0;
        const openingBalance = entitledDays + adjustmentSummary.openingBalanceCorrectionDays;
        const calculatedAvailable =
          entitledDays +
          adjustmentSummary.carryForwardDays +
          adjustmentSummary.manualAdjustmentDays +
          adjustmentSummary.openingBalanceCorrectionDays -
          requestSummary.approvedTakenDays -
          requestSummary.pendingLeaveDays;
        const availableBalance = rule?.isUnlimited ? Number.MAX_SAFE_INTEGER : calculatedAvailable;
        const safeAvailable = rule?.allowNegativeBalance || rule?.isUnlimited ? availableBalance : Math.max(0, availableBalance);
        const status = getBalanceStatus(safeAvailable);

        if (filters.balanceStatus && filters.balanceStatus !== status) continue;

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
          openingBalance,
          entitledDays,
          carryForwardDays: adjustmentSummary.carryForwardDays,
          approvedTakenDays: requestSummary.approvedTakenDays,
          pendingLeaveDays: requestSummary.pendingLeaveDays,
          manualAdjustmentDays:
            adjustmentSummary.manualAdjustmentDays + adjustmentSummary.openingBalanceCorrectionDays,
          availableBalance: safeAvailable,
          expiredLeaveDays: 0,
          encashableDays: rule?.encashmentAllowed ? Math.max(0, safeAvailable) : 0,
          status,
          employeeStatus: employee.status,
        });
      }
    }

    return rows;
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

    const records = await prisma.leaveBalanceAdjustment.findMany({
      where: {
        leaveYear: filters.year,
        employeeId: filters.employeeId || undefined,
        leaveType: filters.leaveType as never || undefined,
        employee: {
          branchId: filters.branchId || undefined,
        },
      },
      include: adjustmentInclude,
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return records.map(serializeAdjustment);
  },

  async createAdjustment(session: AppSession | null, input: LeaveBalanceAdjustmentInput) {
    const actor = await authorize(session, 'hr:write');

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!employee) throw new NotFoundError('Employee not found');

    const normalizedDays = normalizeAdjustmentDays(input.adjustmentType, input.adjustmentDays);
    const adjustmentNo = await nextAdjustmentNumber(input.leaveYear);

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

      return serializeAdjustment(record);
    });
  },

  adjustmentTypes: [...LEAVE_BALANCE_ADJUSTMENT_TYPES],
};
