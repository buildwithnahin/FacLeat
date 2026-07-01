import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification, publishToPermission } from '@/server/notifications/publisher';
import type { AppSession } from '@/server/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type {
  IncrementCreateInput,
  IncrementStatusActionInput,
  IncrementUpdateInput,
} from '@/server/validators/increments';

const ZERO = new Prisma.Decimal(0);
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export const INCREMENT_TABLE_UNAVAILABLE_MESSAGE =
  'Increments are not available yet because the EmployeeIncrement table has not been migrated in this database.';
const INCREMENT_TABLE_CACHE_TTL_MS = 60_000;

let incrementTableAvailabilityCache:
  | {
      checkedAt: number;
      available: boolean;
    }
  | undefined;

export function isEmployeeIncrementTableMissingError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const table = String((error as { meta?: { table?: string } } | null)?.meta?.table ?? '');
  return code === 'P2021' && table.includes('EmployeeIncrement');
}

function hasRole(session: AppSession | null, roles: string[]) {
  return roles.some((role) => session?.roles.includes(role));
}

function hasPermission(session: AppSession | null, permission: string) {
  return session?.permissions.includes(permission) ?? false;
}

function hasIncrementModuleElevatedAccess(session: AppSession | null) {
  if (!session) return false;
  return (
    hasPermission(session, 'hr:read') ||
    hasPermission(session, 'accounts:read') ||
    hasPermission(session, 'accounts:post') ||
    hasRole(session, ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'])
  );
}

function computeGrossSalary(employee: {
  basicSalary: Prisma.Decimal;
  houseAllowance: Prisma.Decimal;
  transportAllowance: Prisma.Decimal;
  medicalAllowance: Prisma.Decimal;
  otherAllowance: Prisma.Decimal;
  providentFund: Prisma.Decimal;
  taxDeduction: Prisma.Decimal;
}) {
  return employee.basicSalary
    .add(employee.houseAllowance ?? ZERO)
    .add(employee.transportAllowance ?? ZERO)
    .add(employee.medicalAllowance ?? ZERO)
    .add(employee.otherAllowance ?? ZERO)
    .sub(employee.providentFund ?? ZERO)
    .sub(employee.taxDeduction ?? ZERO);
}

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function incrementDetailText(record: {
  incrementType: string;
  newBasicSalary: Prisma.Decimal;
  effectiveDate: Date;
}) {
  return `${record.incrementType.toLowerCase()} increment · ${record.newBasicSalary.toString()} effective ${record.effectiveDate
    .toISOString()
    .slice(0, 10)}`;
}

async function nextIncrementNumber(effectiveDate: Date) {
  const year = effectiveDate.getUTCFullYear();
  const prefix = `INC-${year}-`;
  const last = await prisma.employeeIncrement.findFirst({
    where: { incrementNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { incrementNumber: true },
  });
  const lastSeq = last ? parseInt(last.incrementNumber.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
}

function assertHrCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'hr:write') || hasRole(session, ['HR', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only HR can approve or reject this increment');
}

function assertCanReadIncrementModule(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasIncrementModuleElevatedAccess(session) || Boolean(session.userId)) {
    return session;
  }
  throw new ForbiddenError('Missing permission: hr:read or accounts:read');
}

function assertAccountsCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'accounts:post') || hasRole(session, ['Accounts', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only Accounts can approve or reject this increment');
}

function assertCanCreateOrSubmit(session: AppSession | null, managerUserId?: string | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'hr:write') || hasRole(session, ['HR', 'Admin', 'Super Admin'])) return session;
  if (managerUserId && session.userId === managerUserId) return session;
  throw new ForbiddenError('Only HR or the assigned reporting manager can create or submit an increment');
}

const incrementIncludes = {
  branch: { select: { id: true, code: true, name: true } },
  employee: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: true,
      employmentType: true,
      basicSalary: true,
      houseAllowance: true,
      transportAllowance: true,
      medicalAllowance: true,
      otherAllowance: true,
      providentFund: true,
      taxDeduction: true,
      joinedAt: true,
      user: { select: { id: true } },
    },
  },
  reportingManager: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      user: { select: { id: true } },
    },
  },
} as const;

type IncrementRecord = Prisma.EmployeeIncrementGetPayload<{ include: typeof incrementIncludes }>;

function getScopedIncrementWhere(
  session: AppSession,
  filters: {
    branchId?: string;
    employeeId?: string;
    status?: string;
    incrementType?: string;
    q?: string;
  } = {},
): Prisma.EmployeeIncrementWhereInput {
  const managerScope = !hasIncrementModuleElevatedAccess(session)
    ? {
        OR: [
          { createdById: session.userId },
          { reportingManager: { user: { id: session.userId } } },
        ],
      }
    : undefined;

  return {
    branchId: filters.branchId,
    employeeId: filters.employeeId,
    status: filters.status as never,
    incrementType: filters.incrementType as never,
    OR: filters.q
      ? [
          { incrementNumber: { contains: filters.q, mode: 'insensitive' } },
          { employee: { firstName: { contains: filters.q, mode: 'insensitive' } } },
          { employee: { lastName: { contains: filters.q, mode: 'insensitive' } } },
          { employee: { code: { contains: filters.q, mode: 'insensitive' } } },
        ]
      : undefined,
    AND: managerScope ? [managerScope] : undefined,
  };
}

async function assertIncrementTableAvailable() {
  const available = await isIncrementTableAvailable();
  if (!available) {
    throw new ValidationError(INCREMENT_TABLE_UNAVAILABLE_MESSAGE);
  }
}

function assertManagerCanApprove(session: AppSession | null, increment: IncrementRecord | null) {
  if (!session) throw new UnauthorizedError();
  const managerUserId = increment?.reportingManager?.user?.id ?? null;
  if (!managerUserId || session.userId !== managerUserId) {
    throw new ForbiddenError('Only the assigned reporting manager can approve or reject this increment');
  }
}

async function applyIncrementInTx(
  tx: Prisma.TransactionClient,
  increment: IncrementRecord,
  actorUserId?: string | null,
) {
  if (increment.appliedAt || increment.status === 'APPLIED') return increment;

  await tx.employee.update({
    where: { id: increment.employeeId },
    data: {
      basicSalary: increment.newBasicSalary,
      updatedById: actorUserId ?? increment.updatedById ?? increment.createdById ?? null,
    },
  });

  await tx.contract.updateMany({
    where: {
      employeeId: increment.employeeId,
      status: { in: ['ACTIVE', 'SIGNED', 'WAITING_FOR_JOINING'] },
    },
    data: {
      basicSalary: increment.newBasicSalary,
      updatedById: actorUserId ?? increment.updatedById ?? increment.createdById ?? null,
    },
  });

  await tx.employeeSalaryHistory.create({
    data: {
      branchId: increment.branchId,
      employeeId: increment.employeeId,
      sourceType: 'INCREMENT',
      sourceId: increment.id,
      effectiveDate: increment.effectiveDate,
      oldBasicSalary: increment.currentBasicSalary,
      newBasicSalary: increment.newBasicSalary,
      oldGrossSalary: increment.currentGrossSalary,
      newGrossSalary: increment.newGrossSalary,
      remarks: increment.remarks ?? increment.reason,
      appliedAt: new Date(),
      createdById: actorUserId ?? increment.updatedById ?? increment.createdById ?? null,
      updatedById: actorUserId ?? increment.updatedById ?? increment.createdById ?? null,
    },
  });

  return tx.employeeIncrement.update({
    where: { id: increment.id },
    data: {
      status: 'APPLIED',
      appliedAt: new Date(),
      updatedById: actorUserId ?? increment.updatedById ?? increment.createdById ?? null,
    },
    include: incrementIncludes,
  });
}

async function applyDueApprovedIncrements() {
  const available = await isIncrementTableAvailable();
  if (!available) return;

  const due = await prisma.employeeIncrement.findMany({
    where: {
      status: 'APPROVED',
      appliedAt: null,
      effectiveDate: { lte: todayAtMidnight() },
    },
    include: incrementIncludes,
    take: 50,
  });

  for (const record of due) {
    await prisma.$transaction(async (tx) => {
      await applyIncrementInTx(tx, record, record.updatedById ?? record.createdById ?? null);
    });

    if (record.employee.user?.id) {
      await publishNotification({
        recipientId: record.employee.user.id,
        branchId: record.branchId,
        module: 'hr',
        title: 'Increment applied',
        body: incrementDetailText(record),
        href: `/hr/employees/${record.employeeId}`,
      });
    }
  }
}

export async function isIncrementTableAvailable(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    incrementTableAvailabilityCache &&
    now - incrementTableAvailabilityCache.checkedAt < INCREMENT_TABLE_CACHE_TTL_MS
  ) {
    return incrementTableAvailabilityCache.available;
  }

  const rows = await prisma.$queryRaw<Array<{ exists: number } | { exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'EmployeeIncrement'
    ) AS "exists"
  `;

  const available = Boolean(rows[0]?.exists);
  incrementTableAvailabilityCache = { checkedAt: now, available };
  return available;
}

export const incrementsService = {
  async list(
    session: AppSession | null,
    filters: {
      branchId?: string;
      employeeId?: string;
      status?: string;
      incrementType?: string;
      q?: string;
    } = {},
  ) {
    const actor = assertCanReadIncrementModule(session);
    await assertIncrementTableAvailable();
    await applyDueApprovedIncrements();
    return prisma.employeeIncrement.findMany({
      where: getScopedIncrementWhere(actor, filters),
      include: incrementIncludes,
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    const actor = assertCanReadIncrementModule(session);
    await assertIncrementTableAvailable();
    await applyDueApprovedIncrements();
    const increment = await prisma.employeeIncrement.findFirst({
      where: {
        id,
        ...(hasIncrementModuleElevatedAccess(actor)
          ? {}
          : {
              OR: [
                { createdById: actor.userId },
                { reportingManager: { user: { id: actor.userId } } },
              ],
            }),
      },
      include: incrementIncludes,
    });
    if (!increment) throw new NotFoundError('Increment not found');
    return increment;
  },

  async create(session: AppSession | null, input: IncrementCreateInput) {
    await assertIncrementTableAvailable();
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, reportingManager: { include: { user: true } } },
    });
    if (!employee) throw new ValidationError('Employee not found');

    const actor = assertCanCreateOrSubmit(session, employee.reportingManager?.user?.id ?? null);
    const currentGrossSalary = computeGrossSalary(employee);
    const incrementAmount =
      input.incrementMethod === 'PERCENTAGE'
        ? employee.basicSalary.mul(D(input.incrementValue)).div(100)
        : D(input.incrementValue);
    const newBasicSalary = employee.basicSalary.add(incrementAmount);
    const newGrossSalary = currentGrossSalary.add(incrementAmount);
    if (newBasicSalary.lte(ZERO)) {
      throw new ValidationError('New basic salary must be greater than zero');
    }

    const incrementNumber = await nextIncrementNumber(input.effectiveDate);

    return prisma.$transaction(async (tx) => {
      const record = await tx.employeeIncrement.create({
        data: {
          incrementNumber,
          branchId: employee.branchId,
          employeeId: employee.id,
          incrementType: input.incrementType,
          incrementMethod: input.incrementMethod,
          status: 'DRAFT',
          currentBranch: employee.branch.name,
          currentDepartment: employee.department ?? null,
          currentDesignation: employee.designation ?? null,
          currentEmploymentType: employee.employmentType ?? null,
          currentBasicSalary: employee.basicSalary,
          currentGrossSalary,
          reportingManagerId: employee.reportingManagerId ?? null,
          incrementValue: D(input.incrementValue),
          newBasicSalary,
          newGrossSalary,
          effectiveDate: input.effectiveDate,
          reason: input.reason,
          performanceSummary: input.performanceSummary || null,
          remarks: input.remarks || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
        include: incrementIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: record.branchId,
          module: 'hr',
          action: 'create-increment',
          entityType: 'EmployeeIncrement',
          entityId: record.id,
          after: {
            incrementNumber: record.incrementNumber,
            employeeCode: record.employee.code,
            status: record.status,
          },
        },
        tx,
      );

      return record;
    });
  },

  async update(session: AppSession | null, input: IncrementUpdateInput) {
    await assertIncrementTableAvailable();
    const existing = await prisma.employeeIncrement.findUnique({
      where: { id: input.id },
      include: { reportingManager: { select: { user: { select: { id: true } } } } },
    });
    if (!existing) throw new NotFoundError('Increment not found');
    if (existing.status !== 'DRAFT') throw new ValidationError('Only draft increments can be edited');

    const actor = assertCanCreateOrSubmit(session, existing.reportingManager?.user?.id ?? null);
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, reportingManager: { include: { user: true } } },
    });
    if (!employee) throw new ValidationError('Employee not found');

    const currentGrossSalary = computeGrossSalary(employee);
    const incrementAmount =
      input.incrementMethod === 'PERCENTAGE'
        ? employee.basicSalary.mul(D(input.incrementValue)).div(100)
        : D(input.incrementValue);
    const newBasicSalary = employee.basicSalary.add(incrementAmount);
    const newGrossSalary = currentGrossSalary.add(incrementAmount);

    return prisma.$transaction(async (tx) => {
      const record = await tx.employeeIncrement.update({
        where: { id: input.id },
        data: {
          branchId: employee.branchId,
          employeeId: employee.id,
          incrementType: input.incrementType,
          incrementMethod: input.incrementMethod,
          currentBranch: employee.branch.name,
          currentDepartment: employee.department ?? null,
          currentDesignation: employee.designation ?? null,
          currentEmploymentType: employee.employmentType ?? null,
          currentBasicSalary: employee.basicSalary,
          currentGrossSalary,
          reportingManagerId: employee.reportingManagerId ?? null,
          incrementValue: D(input.incrementValue),
          newBasicSalary,
          newGrossSalary,
          effectiveDate: input.effectiveDate,
          reason: input.reason,
          performanceSummary: input.performanceSummary || null,
          remarks: input.remarks || null,
          updatedById: actor.userId,
        },
        include: incrementIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: record.branchId,
          module: 'hr',
          action: 'update-increment',
          entityType: 'EmployeeIncrement',
          entityId: record.id,
          before: { status: existing.status },
          after: { status: record.status },
        },
        tx,
      );

      return record;
    });
  },

  async changeStatus(session: AppSession | null, input: IncrementStatusActionInput) {
    await assertIncrementTableAvailable();
    const increment = await prisma.employeeIncrement.findUnique({
      where: { id: input.id },
      include: incrementIncludes,
    });
    if (!increment) throw new NotFoundError('Increment not found');

    const validTransitions: Record<string, string[]> = {
      submit: ['DRAFT'],
      hr_approve: ['SUBMITTED', 'PENDING_HR_APPROVAL'],
      hr_reject: ['SUBMITTED', 'PENDING_HR_APPROVAL'],
      accounts_approve: ['PENDING_ACCOUNTS_APPROVAL'],
      accounts_reject: ['PENDING_ACCOUNTS_APPROVAL'],
      manager_approve: ['PENDING_MANAGER_APPROVAL'],
      manager_reject: ['PENDING_MANAGER_APPROVAL'],
      apply: ['APPROVED'],
    };

    const allowed = validTransitions[input.action];
    if (!allowed?.includes(increment.status)) {
      throw new ValidationError(`Cannot ${input.action} an increment in ${increment.status} status`);
    }

    let actor: AppSession;
    switch (input.action) {
      case 'submit':
        actor = assertCanCreateOrSubmit(session, increment.reportingManager?.user?.id ?? null);
        break;
      case 'hr_approve':
      case 'hr_reject':
        actor = assertHrCanReview(session);
        break;
      case 'accounts_approve':
      case 'accounts_reject':
        actor = assertAccountsCanReview(session);
        break;
      case 'manager_approve':
      case 'manager_reject':
        assertManagerCanApprove(session, increment);
        actor = session as AppSession;
        break;
      case 'apply':
        actor = assertHrCanReview(session);
        break;
      default:
        throw new ValidationError('Unsupported action');
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: Prisma.EmployeeIncrementUpdateInput = {
        updatedById: actor.userId,
      };

      if (input.action === 'submit') {
        updateData.status = 'PENDING_HR_APPROVAL';
      } else if (input.action === 'hr_approve') {
        updateData.status = 'PENDING_ACCOUNTS_APPROVAL';
        updateData.hrApprovalStatus = 'APPROVED';
        updateData.hrApprovalDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'hr_reject') {
        updateData.status = 'REJECTED';
        updateData.hrApprovalStatus = 'REJECTED';
        updateData.hrApprovalDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'accounts_approve') {
        if (input.budgetVerified !== true) {
          throw new ValidationError('Accounts approval requires budget verification');
        }
        updateData.status = 'PENDING_MANAGER_APPROVAL';
        updateData.accountsApprovalStatus = 'APPROVED';
        updateData.accountsApprovalDate = now;
        updateData.budgetVerified = true;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'accounts_reject') {
        updateData.status = 'REJECTED';
        updateData.accountsApprovalStatus = 'REJECTED';
        updateData.accountsApprovalDate = now;
        updateData.budgetVerified = input.budgetVerified ?? false;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'manager_approve') {
        updateData.status = 'APPROVED';
        updateData.managerApprovalStatus = 'APPROVED';
        updateData.managerApprovalDate = now;
        updateData.managerRemarks = input.note || null;
        updateData.approvedAt = now;
        updateData.letterGeneratedAt = now;
      } else if (input.action === 'manager_reject') {
        updateData.status = 'REJECTED';
        updateData.managerApprovalStatus = 'REJECTED';
        updateData.managerApprovalDate = now;
        updateData.managerRemarks = input.note || null;
      }

      let updated = await tx.employeeIncrement.update({
        where: { id: increment.id },
        data: updateData,
        include: incrementIncludes,
      });

      if (input.action === 'manager_approve' && updated.effectiveDate <= todayAtMidnight()) {
        updated = await applyIncrementInTx(tx, updated, actor.userId);
      } else if (input.action === 'apply') {
        if (increment.effectiveDate > todayAtMidnight()) {
          throw new ValidationError('Increment can only be applied on or after the effective date');
        }
        updated = await applyIncrementInTx(tx, increment, actor.userId);
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: increment.branchId,
          module: 'hr',
          action: `increment-${input.action}`,
          entityType: 'EmployeeIncrement',
          entityId: increment.id,
          before: { status: increment.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });

    if (input.action === 'submit') {
      await publishToPermission('hr:write', {
        branchId: increment.branchId,
        module: 'hr',
        title: `Increment review needed: ${increment.employee.firstName} ${increment.employee.lastName}`,
        body: incrementDetailText(increment),
        href: '/hr/increments',
      });
    }

    if (input.action === 'hr_approve') {
      await publishToPermission('accounts:post', {
        branchId: increment.branchId,
        module: 'hr',
        title: `Accounts verification needed: ${increment.employee.firstName} ${increment.employee.lastName}`,
        body: incrementDetailText(increment),
        href: '/hr/increments',
      });
    }

    if (input.action === 'accounts_approve' && increment.reportingManager?.user?.id) {
      await publishNotification({
        recipientId: increment.reportingManager.user.id,
        branchId: increment.branchId,
        module: 'hr',
        title: `Final increment approval needed: ${increment.employee.firstName} ${increment.employee.lastName}`,
        body: incrementDetailText(increment),
        href: '/hr/increments',
      });
    }

    if (['hr_reject', 'accounts_reject', 'manager_reject'].includes(input.action) && increment.createdById) {
      await publishNotification({
        recipientId: increment.createdById,
        branchId: increment.branchId,
        severity: 'WARNING',
        module: 'hr',
        title: 'Increment request rejected',
        body: input.note || incrementDetailText(increment),
        href: '/hr/increments',
      });
    }

    if (input.action === 'manager_approve') {
      if (increment.employee.user?.id) {
        await publishNotification({
          recipientId: increment.employee.user.id,
          branchId: increment.branchId,
          module: 'hr',
          title: result.status === 'APPLIED' ? 'Increment approved and applied' : 'Increment approved',
          body: incrementDetailText(increment),
          href: `/hr/employees/${increment.employeeId}`,
        });
      }
      if (increment.createdById) {
        await publishNotification({
          recipientId: increment.createdById,
          branchId: increment.branchId,
          module: 'hr',
          title: 'Increment approved',
          body: incrementDetailText(increment),
          href: '/hr/increments',
        });
      }
    }

    return result;
  },

  async countByStatus(session: AppSession | null, branchId?: string) {
    const actor = assertCanReadIncrementModule(session);
    await assertIncrementTableAvailable();
    await applyDueApprovedIncrements();
    const counts = await prisma.employeeIncrement.groupBy({
      by: ['status'],
      where: getScopedIncrementWhere(actor, { branchId }),
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const row of counts) result[row.status] = row._count;
    return result;
  },
};
