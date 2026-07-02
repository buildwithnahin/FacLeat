import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { listActiveHolidaysInRange } from '@/server/services/holidays.service';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  LeavePolicyCreateInput,
  LeavePolicyRuleInput,
  LeavePolicyUpdateInput,
} from '@/server/validators/leave-policies';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const ACTIVE_EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE'] as const;

export const LEGACY_LEAVE_ENTITLEMENTS: Record<string, number> = {
  CASUAL: 10,
  SICK: 14,
  EARNED: 15,
  ANNUAL: 20,
  MATERNITY: 112,
  PATERNITY: 10,
  EMERGENCY: 5,
  UNPAID: 100,
  COMPENSATORY: 10,
  SPECIAL: 10,
  FESTIVAL: 2,
  OTHER: 10,
};

type EmployeeResolverRecord = {
  id: string;
  code: string;
  branchId: string;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  joinedAt: Date;
  shift?: { weeklyOffDays: Prisma.JsonValue | null } | null;
};

const POLICY_INCLUDE = {
  branch: { select: { id: true, code: true, name: true } },
  rules: { orderBy: [{ leaveType: 'asc' }] },
  employeeAssignments: {
    where: { status: 'ACTIVE' },
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
        },
      },
    },
    orderBy: [{ assignedDate: 'desc' }],
  },
} satisfies Prisma.LeavePolicyInclude;

type LeavePolicyRecord = Prisma.LeavePolicyGetPayload<{ include: typeof POLICY_INCLUDE }>;

export type ResolvedLeaveRule = {
  leaveType: string;
  leaveCode: string;
  paidLeave: boolean;
  entitledDays: number | null;
  isUnlimited: boolean;
  accrualMethod: string;
  minimumServiceMonths: number | null;
  maxLeavePerRequest: number | null;
  maxLeavePerMonth: number | null;
  halfDayAllowed: boolean;
  attachmentRequired: boolean;
  reasonRequired: boolean;
  allowNegativeBalance: boolean;
  includeWeekend: boolean;
  includeHoliday: boolean;
  sandwichRuleApplicable: boolean;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  encashmentAllowed: boolean;
  maxEncashmentDays: number | null;
  payrollImpact: string;
  status: string;
};

export type ResolvedLeavePolicy = {
  id: string;
  policyCode: string;
  policyName: string;
  status: string;
  description: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: 'assignment' | 'applicability' | 'legacy';
  branchId: string | null;
  branchName: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  approvalRequired: boolean;
  managerApprovalRequired: boolean;
  hrApprovalRequired: boolean;
  accountsApprovalRequired: boolean;
  autoApproveAllowed: boolean;
  hrCanOverrideBalance: boolean;
  allowProbationEmployees: boolean;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  carryForwardExpiryMonth: number | null;
  carryForwardExpiryDay: number | null;
  encashmentAllowed: boolean;
  maxEncashmentDays: number | null;
  autoClosing: boolean;
  payrollImpactDefault: string;
  rules: ResolvedLeaveRule[];
};

function toNullableNumber(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : Number(value);
}

function normalizeDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toDateString(value: Date | null | undefined) {
  return value ? normalizeDate(value).toISOString().slice(0, 10) : null;
}

function isWeeklyOff(date: Date, weeklyOffDaysJson: Prisma.JsonValue | null) {
  if (!weeklyOffDaysJson) return date.getUTCDay() === 5;
  if (!Array.isArray(weeklyOffDaysJson)) return date.getUTCDay() === 5;
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return weeklyOffDaysJson.includes(dayName);
}

function ruleToResolvedRule(rule: LeavePolicyRecord['rules'][number]): ResolvedLeaveRule {
  return {
    leaveType: rule.leaveType,
    leaveCode: rule.leaveCode,
    paidLeave: rule.paidLeave,
    entitledDays: toNullableNumber(rule.entitledDays),
    isUnlimited: rule.isUnlimited,
    accrualMethod: rule.accrualMethod,
    minimumServiceMonths: rule.minimumServiceMonths,
    maxLeavePerRequest: toNullableNumber(rule.maxLeavePerRequest),
    maxLeavePerMonth: toNullableNumber(rule.maxLeavePerMonth),
    halfDayAllowed: rule.halfDayAllowed,
    attachmentRequired: rule.attachmentRequired,
    reasonRequired: rule.reasonRequired,
    allowNegativeBalance: rule.allowNegativeBalance,
    includeWeekend: rule.includeWeekend,
    includeHoliday: rule.includeHoliday,
    sandwichRuleApplicable: rule.sandwichRuleApplicable,
    carryForwardAllowed: rule.carryForwardAllowed,
    maxCarryForwardDays: toNullableNumber(rule.maxCarryForwardDays),
    encashmentAllowed: rule.encashmentAllowed,
    maxEncashmentDays: toNullableNumber(rule.maxEncashmentDays),
    payrollImpact: rule.payrollImpact,
    status: rule.status,
  };
}

function buildLegacyPolicy(employee: Pick<EmployeeResolverRecord, 'employmentType'>): ResolvedLeavePolicy {
  const label = employee.employmentType
    ? `${employee.employmentType.charAt(0)}${employee.employmentType.slice(1).toLowerCase()} Leave Policy`
    : 'Standard Leave Policy';

  return {
    id: 'legacy',
    policyCode: 'LEGACY',
    policyName: label,
    status: 'ACTIVE',
    description: 'Fallback legacy leave configuration.',
    effectiveFrom: '1970-01-01',
    effectiveTo: null,
    source: 'legacy',
    branchId: null,
    branchName: null,
    department: null,
    designation: null,
    employmentType: employee.employmentType ?? null,
    approvalRequired: true,
    managerApprovalRequired: true,
    hrApprovalRequired: true,
    accountsApprovalRequired: false,
    autoApproveAllowed: false,
    hrCanOverrideBalance: true,
    allowProbationEmployees: true,
    carryForwardAllowed: false,
    maxCarryForwardDays: null,
    carryForwardExpiryMonth: null,
    carryForwardExpiryDay: null,
    encashmentAllowed: false,
    maxEncashmentDays: null,
    autoClosing: false,
    payrollImpactDefault: 'NO_PAYROLL_IMPACT',
    rules: Object.entries(LEGACY_LEAVE_ENTITLEMENTS).map(([leaveType, entitledDays]) => ({
      leaveType,
      leaveCode: leaveType,
      paidLeave: leaveType !== 'UNPAID',
      entitledDays,
      isUnlimited: false,
      accrualMethod: 'YEARLY_ALLOCATION',
      minimumServiceMonths: null,
      maxLeavePerRequest: null,
      maxLeavePerMonth: null,
      halfDayAllowed: leaveType !== 'MATERNITY',
      attachmentRequired: false,
      reasonRequired: true,
      allowNegativeBalance: leaveType === 'UNPAID',
      includeWeekend: true,
      includeHoliday: false,
      sandwichRuleApplicable: false,
      carryForwardAllowed: false,
      maxCarryForwardDays: null,
      encashmentAllowed: false,
      maxEncashmentDays: null,
      payrollImpact: leaveType === 'UNPAID' ? 'UNPAID_LEAVE_DEDUCTION' : 'PAID_LEAVE',
      status: 'ACTIVE',
    })),
  };
}

function serializePolicy(policy: LeavePolicyRecord) {
  return {
    id: policy.id,
    policyCode: policy.policyCode,
    policyName: policy.policyName,
    branchId: policy.branchId,
    branch: policy.branch,
    department: policy.department,
    designation: policy.designation,
    employmentType: policy.employmentType,
    employeeCategory: policy.employeeCategory,
    gender: policy.gender,
    grade: policy.grade,
    effectiveFrom: toDateString(policy.effectiveFrom),
    effectiveTo: toDateString(policy.effectiveTo),
    status: policy.status,
    description: policy.description,
    approvalRequired: policy.approvalRequired,
    managerApprovalRequired: policy.managerApprovalRequired,
    hrApprovalRequired: policy.hrApprovalRequired,
    accountsApprovalRequired: policy.accountsApprovalRequired,
    autoApproveAllowed: policy.autoApproveAllowed,
    hrCanOverrideBalance: policy.hrCanOverrideBalance,
    allowProbationEmployees: policy.allowProbationEmployees,
    carryForwardAllowed: policy.carryForwardAllowed,
    maxCarryForwardDays: toNullableNumber(policy.maxCarryForwardDays),
    carryForwardExpiryMonth: policy.carryForwardExpiryMonth,
    carryForwardExpiryDay: policy.carryForwardExpiryDay,
    encashmentAllowed: policy.encashmentAllowed,
    maxEncashmentDays: toNullableNumber(policy.maxEncashmentDays),
    autoClosing: policy.autoClosing,
    payrollImpactDefault: policy.payrollImpactDefault,
    rules: policy.rules.map(ruleToResolvedRule),
    assignedEmployees: policy.employeeAssignments.map((assignment) => ({
      id: assignment.employee.id,
      assignmentId: assignment.id,
      code: assignment.employee.code,
      name: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      department: assignment.employee.department,
      designation: assignment.employee.designation,
      employmentType: assignment.employee.employmentType,
    })),
  };
}

function resolveRuleStatus(rule: ResolvedLeaveRule) {
  return rule.status.toUpperCase() === 'ACTIVE';
}

function hasUnsupportedApplicability(policy: {
  employeeCategory: string | null;
  gender: string | null;
  grade: string | null;
}) {
  return Boolean(policy.employeeCategory || policy.gender || policy.grade);
}

function policySpecificity(policy: {
  branchId: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
}) {
  return [policy.branchId, policy.department, policy.designation, policy.employmentType].filter(Boolean).length;
}

function matchesPolicyApplicability(employee: EmployeeResolverRecord, policy: LeavePolicyRecord, asOfDate: Date) {
  if (policy.status !== 'ACTIVE') return false;
  if (normalizeDate(policy.effectiveFrom) > normalizeDate(asOfDate)) return false;
  if (policy.effectiveTo && normalizeDate(policy.effectiveTo) < normalizeDate(asOfDate)) return false;
  if (hasUnsupportedApplicability(policy)) return false;
  if (policy.branchId && policy.branchId !== employee.branchId) return false;
  if (policy.department && policy.department !== employee.department) return false;
  if (policy.designation && policy.designation !== employee.designation) return false;
  if (policy.employmentType && policy.employmentType !== employee.employmentType) return false;
  return true;
}

function policyToResolved(policy: LeavePolicyRecord, source: 'assignment' | 'applicability'): ResolvedLeavePolicy {
  return {
    id: policy.id,
    policyCode: policy.policyCode,
    policyName: policy.policyName,
    status: policy.status,
    description: policy.description,
    effectiveFrom: toDateString(policy.effectiveFrom) ?? '',
    effectiveTo: toDateString(policy.effectiveTo),
    source,
    branchId: policy.branchId,
    branchName: policy.branch?.name ?? null,
    department: policy.department,
    designation: policy.designation,
    employmentType: policy.employmentType,
    approvalRequired: policy.approvalRequired,
    managerApprovalRequired: policy.managerApprovalRequired,
    hrApprovalRequired: policy.hrApprovalRequired,
    accountsApprovalRequired: policy.accountsApprovalRequired,
    autoApproveAllowed: policy.autoApproveAllowed,
    hrCanOverrideBalance: policy.hrCanOverrideBalance,
    allowProbationEmployees: policy.allowProbationEmployees,
    carryForwardAllowed: policy.carryForwardAllowed,
    maxCarryForwardDays: toNullableNumber(policy.maxCarryForwardDays),
    carryForwardExpiryMonth: policy.carryForwardExpiryMonth,
    carryForwardExpiryDay: policy.carryForwardExpiryDay,
    encashmentAllowed: policy.encashmentAllowed,
    maxEncashmentDays: toNullableNumber(policy.maxEncashmentDays),
    autoClosing: policy.autoClosing,
    payrollImpactDefault: policy.payrollImpactDefault,
    rules: policy.rules.map(ruleToResolvedRule),
  };
}

function buildPolicyWriteData(input: LeavePolicyCreateInput | LeavePolicyUpdateInput, actorUserId: string) {
  return {
    policyCode: input.policyCode.toUpperCase(),
    policyName: input.policyName,
    branchId: input.branchId || null,
    department: input.department || null,
    designation: input.designation || null,
    employmentType: input.employmentType || null,
    employeeCategory: input.employeeCategory || null,
    gender: input.gender || null,
    grade: input.grade || null,
    effectiveFrom: normalizeDate(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? normalizeDate(input.effectiveTo) : null,
    status: input.status,
    description: input.description || null,
    approvalRequired: input.approvalRequired,
    managerApprovalRequired: input.managerApprovalRequired,
    hrApprovalRequired: input.hrApprovalRequired,
    accountsApprovalRequired: input.accountsApprovalRequired,
    autoApproveAllowed: input.autoApproveAllowed,
    hrCanOverrideBalance: input.hrCanOverrideBalance,
    allowProbationEmployees: input.allowProbationEmployees,
    carryForwardAllowed: input.carryForwardAllowed,
    maxCarryForwardDays: input.maxCarryForwardDays != null ? D(input.maxCarryForwardDays) : null,
    carryForwardExpiryMonth: input.carryForwardExpiryMonth != null ? Math.trunc(input.carryForwardExpiryMonth) : null,
    carryForwardExpiryDay: input.carryForwardExpiryDay != null ? Math.trunc(input.carryForwardExpiryDay) : null,
    encashmentAllowed: input.encashmentAllowed,
    maxEncashmentDays: input.maxEncashmentDays != null ? D(input.maxEncashmentDays) : null,
    autoClosing: input.autoClosing,
    payrollImpactDefault: input.payrollImpactDefault,
    updatedById: actorUserId,
  };
}

function buildRuleCreateMany(rules: LeavePolicyRuleInput[]) {
  return rules.map((rule) => ({
    leaveType: rule.leaveType,
    leaveCode: rule.leaveCode.toUpperCase(),
    paidLeave: rule.paidLeave,
    entitledDays: !rule.isUnlimited && rule.entitledDays != null ? D(rule.entitledDays) : null,
    isUnlimited: rule.isUnlimited,
    accrualMethod: rule.accrualMethod,
    minimumServiceMonths: rule.minimumServiceMonths != null ? Math.trunc(rule.minimumServiceMonths) : null,
    maxLeavePerRequest: rule.maxLeavePerRequest != null ? D(rule.maxLeavePerRequest) : null,
    maxLeavePerMonth: rule.maxLeavePerMonth != null ? D(rule.maxLeavePerMonth) : null,
    halfDayAllowed: rule.halfDayAllowed,
    attachmentRequired: rule.attachmentRequired,
    reasonRequired: rule.reasonRequired,
    allowNegativeBalance: rule.allowNegativeBalance,
    includeWeekend: rule.includeWeekend,
    includeHoliday: rule.includeHoliday,
    sandwichRuleApplicable: rule.sandwichRuleApplicable,
    carryForwardAllowed: rule.carryForwardAllowed,
    maxCarryForwardDays: rule.maxCarryForwardDays != null ? D(rule.maxCarryForwardDays) : null,
    encashmentAllowed: rule.encashmentAllowed,
    maxEncashmentDays: rule.maxEncashmentDays != null ? D(rule.maxEncashmentDays) : null,
    payrollImpact: rule.payrollImpact,
    status: rule.status,
  }));
}

async function getEmployeeResolverRecord(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      code: true,
      branchId: true,
      department: true,
      designation: true,
      employmentType: true,
      joinedAt: true,
      shift: { select: { weeklyOffDays: true } },
    },
  });
  if (!employee) throw new NotFoundError('Employee not found');
  return employee;
}

export async function resolveLeavePolicyForEmployee(employeeId: string, asOfDate = new Date()): Promise<ResolvedLeavePolicy> {
  const employee = await getEmployeeResolverRecord(employeeId);

  const explicitAssignment = await prisma.employeeLeavePolicy.findFirst({
    where: {
      employeeId,
      status: 'ACTIVE',
      policy: {
        status: 'ACTIVE',
        effectiveFrom: { lte: normalizeDate(asOfDate) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: normalizeDate(asOfDate) } }],
      },
    },
    include: {
      policy: { include: POLICY_INCLUDE },
    },
    orderBy: [{ assignedDate: 'desc' }],
  });

  if (explicitAssignment) {
    return policyToResolved(explicitAssignment.policy, 'assignment');
  }

  const candidates = await prisma.leavePolicy.findMany({
    where: {
      status: 'ACTIVE',
      effectiveFrom: { lte: normalizeDate(asOfDate) },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: normalizeDate(asOfDate) } }],
      OR: [{ branchId: null }, { branchId: employee.branchId }],
    },
    include: POLICY_INCLUDE,
  });

  const matched = candidates
    .filter((policy) => matchesPolicyApplicability(employee, policy, asOfDate))
    .sort((a, b) => {
      const specificityDiff = policySpecificity(b) - policySpecificity(a);
      if (specificityDiff !== 0) return specificityDiff;
      return normalizeDate(b.effectiveFrom).getTime() - normalizeDate(a.effectiveFrom).getTime();
    })[0];

  if (matched) {
    return policyToResolved(matched, 'applicability');
  }

  return buildLegacyPolicy(employee);
}

export async function calculateRequestedLeaveDays(
  employeeId: string,
  fromDate: Date,
  toDate: Date,
  rule: Pick<ResolvedLeaveRule, 'includeHoliday' | 'includeWeekend'>,
) {
  const employee = await getEmployeeResolverRecord(employeeId);
  const holidays = await listActiveHolidaysInRange(fromDate, toDate, employee.branchId);
  const holidaySet = new Set<string>();

  for (const holiday of holidays) {
    const start = normalizeDate(holiday.startDate);
    const end = normalizeDate(holiday.endDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      holidaySet.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  let days = 0;
  const cursor = normalizeDate(fromDate);
  const end = normalizeDate(toDate);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const holiday = holidaySet.has(key);
    const weeklyOff = isWeeklyOff(cursor, employee.shift?.weeklyOffDays ?? null);

    if ((!holiday || rule.includeHoliday) && (!weeklyOff || rule.includeWeekend)) {
      days += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export const leavePoliciesService = {
  async list(session: AppSession | null) {
    await authorize(session, 'hr:read');
    const policies = await prisma.leavePolicy.findMany({
      include: POLICY_INCLUDE,
      orderBy: [{ effectiveFrom: 'desc' }, { policyCode: 'asc' }],
    });
    return policies.map(serializePolicy);
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const policy = await prisma.leavePolicy.findUnique({
      where: { id },
      include: POLICY_INCLUDE,
    });
    if (!policy) throw new NotFoundError('Leave policy not found');
    return serializePolicy(policy);
  },

  async create(session: AppSession | null, input: LeavePolicyCreateInput) {
    const actor = await authorize(session, 'hr:write');
    const data = buildPolicyWriteData(input, actor.userId);

    return prisma.$transaction(async (tx) => {
      const policy = await tx.leavePolicy.create({
        data: {
          ...data,
          createdById: actor.userId,
          rules: {
            createMany: {
              data: buildRuleCreateMany(input.rules),
            },
          },
          employeeAssignments: input.assignedEmployeeIds.length
            ? {
                createMany: {
                  data: input.assignedEmployeeIds.map((employeeId) => ({
                    employeeId,
                    createdById: actor.userId,
                    status: 'ACTIVE',
                  })),
                },
              }
            : undefined,
        },
        include: POLICY_INCLUDE,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: policy.branchId,
          module: 'hr',
          action: 'create-leave-policy',
          entityType: 'LeavePolicy',
          entityId: policy.id,
          after: { policyCode: policy.policyCode, policyName: policy.policyName, status: policy.status },
        },
        tx,
      );

      return serializePolicy(policy);
    });
  },

  async update(session: AppSession | null, input: LeavePolicyUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.leavePolicy.findUnique({
      where: { id: input.id },
      include: POLICY_INCLUDE,
    });
    if (!existing) throw new NotFoundError('Leave policy not found');

    const data = buildPolicyWriteData(input, actor.userId);

    return prisma.$transaction(async (tx) => {
      await tx.leavePolicyRule.deleteMany({ where: { policyId: input.id } });
      await tx.employeeLeavePolicy.deleteMany({ where: { policyId: input.id } });

      const policy = await tx.leavePolicy.update({
        where: { id: input.id },
        data: {
          ...data,
          rules: {
            createMany: {
              data: buildRuleCreateMany(input.rules),
            },
          },
          employeeAssignments: input.assignedEmployeeIds.length
            ? {
                createMany: {
                  data: input.assignedEmployeeIds.map((employeeId) => ({
                    employeeId,
                    createdById: actor.userId,
                    status: 'ACTIVE',
                  })),
                },
              }
            : undefined,
        },
        include: POLICY_INCLUDE,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: policy.branchId,
          module: 'hr',
          action: 'update-leave-policy',
          entityType: 'LeavePolicy',
          entityId: policy.id,
          before: { policyCode: existing.policyCode, policyName: existing.policyName, status: existing.status },
          after: { policyCode: policy.policyCode, policyName: policy.policyName, status: policy.status },
        },
        tx,
      );

      return serializePolicy(policy);
    });
  },

  async generateAssignments(session: AppSession | null, policyId: string) {
    const actor = await authorize(session, 'hr:write');
    const policy = await prisma.leavePolicy.findUnique({
      where: { id: policyId },
      include: POLICY_INCLUDE,
    });
    if (!policy) throw new NotFoundError('Leave policy not found');

    if (hasUnsupportedApplicability(policy)) {
      throw new ValidationError(
        'This policy uses employee category, gender, or grade. Assign employees manually until those fields exist in the employee master.',
      );
    }

    const employees = await prisma.employee.findMany({
      where: {
        status: { in: [...ACTIVE_EMPLOYEE_STATUSES] },
        branchId: policy.branchId || undefined,
        department: policy.department || undefined,
        designation: policy.designation || undefined,
        employmentType: policy.employmentType || undefined,
      },
      select: { id: true },
    });

    if (employees.length === 0) return { createdCount: 0 };

    await prisma.$transaction(async (tx) => {
      for (const employee of employees) {
        await tx.employeeLeavePolicy.upsert({
          where: {
            employeeId_policyId: {
              employeeId: employee.id,
              policyId,
            },
          },
          update: {
            status: 'ACTIVE',
            createdById: actor.userId,
          },
          create: {
            employeeId: employee.id,
            policyId,
            createdById: actor.userId,
            status: 'ACTIVE',
          },
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: policy.branchId,
          module: 'hr',
          action: 'generate-leave-policy-assignments',
          entityType: 'LeavePolicy',
          entityId: policy.id,
          after: { assignedEmployees: employees.length, policyCode: policy.policyCode },
        },
        tx,
      );
    });

    return { createdCount: employees.length };
  },

  async listAssignableEmployees(session: AppSession | null) {
    await authorize(session, 'hr:read');
    const employees = await prisma.employee.findMany({
      where: { status: { in: [...ACTIVE_EMPLOYEE_STATUSES] } },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        branchId: true,
        branch: { select: { name: true, code: true } },
        department: true,
        designation: true,
        employmentType: true,
      },
      orderBy: [{ code: 'asc' }],
    });

    return employees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: `${employee.firstName} ${employee.lastName}`,
      branchId: employee.branchId,
      branchLabel: `${employee.branch.code} · ${employee.branch.name}`,
      department: employee.department,
      designation: employee.designation,
      employmentType: employee.employmentType,
    }));
  },
};
