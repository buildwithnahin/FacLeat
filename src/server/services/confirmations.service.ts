import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification, publishToPermission } from '@/server/notifications/publisher';
import type { AppSession } from '@/server/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type {
  ConfirmationCreateInput,
  ConfirmationStatusActionInput,
  ConfirmationUpdateInput,
} from '@/server/validators/confirmations';

const ZERO = new Prisma.Decimal(0);
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export const CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE =
  'Confirmations are not available yet because the EmployeeConfirmation table has not been migrated in this database.';
const CONFIRMATION_TABLE_CACHE_TTL_MS = 60_000;

let confirmationTableAvailabilityCache:
  | {
      checkedAt: number;
      available: boolean;
    }
  | undefined;

export function isEmployeeConfirmationTableMissingError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const table = String((error as { meta?: { table?: string } } | null)?.meta?.table ?? '');
  return code === 'P2021' && table.includes('EmployeeConfirmation');
}

function hasRole(session: AppSession | null, roles: string[]) {
  return roles.some((role) => session?.roles.includes(role));
}

function hasPermission(session: AppSession | null, permission: string) {
  return session?.permissions.includes(permission) ?? false;
}

function hasConfirmationElevatedAccess(session: AppSession | null) {
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

function confirmationDetailText(record: {
  confirmationType: string;
  effectiveDate: Date;
  newBasicSalary: Prisma.Decimal;
  salaryRevisionRequired: boolean;
}) {
  return `${record.confirmationType.toLowerCase().replaceAll('_', ' ')} effective ${record.effectiveDate
    .toISOString()
    .slice(0, 10)}${record.salaryRevisionRequired ? ` · salary ${record.newBasicSalary.toString()}` : ''}`;
}

function normalizeIncrementAmount(value: ConfirmationCreateInput['incrementAmount']) {
  if (value === '' || value == null) return ZERO;
  return D(value);
}

async function nextConfirmationNumber(effectiveDate: Date) {
  const year = effectiveDate.getUTCFullYear();
  const prefix = `CNF-${year}-`;
  const last = await prisma.employeeConfirmation.findFirst({
    where: { confirmationNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { confirmationNumber: true },
  });
  const lastSeq = last ? parseInt(last.confirmationNumber.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
}

function assertCanReadConfirmationModule(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasConfirmationElevatedAccess(session) || Boolean(session.userId)) return session;
  throw new ForbiddenError('Missing permission: hr:read or accounts:read');
}

function assertHrCanWrite(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'hr:write') || hasRole(session, ['HR', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only HR can create or update confirmations');
}

function assertHrCanReview(session: AppSession | null) {
  return assertHrCanWrite(session);
}

function assertAccountsCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'accounts:post') || hasRole(session, ['Accounts', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only Accounts can review this confirmation');
}

const confirmationIncludes = {
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
      email: true,
      firstName: true,
      lastName: true,
      user: { select: { id: true } },
    },
  },
} as const;

type ConfirmationRecord = Prisma.EmployeeConfirmationGetPayload<{ include: typeof confirmationIncludes }>;

function getScopedConfirmationWhere(
  session: AppSession,
  filters: {
    branchId?: string;
    employeeId?: string;
    status?: string;
    confirmationType?: string;
    q?: string;
  } = {},
): Prisma.EmployeeConfirmationWhereInput {
  const managerScope = !hasConfirmationElevatedAccess(session)
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
    confirmationType: filters.confirmationType as never,
    OR: filters.q
      ? [
          { confirmationNumber: { contains: filters.q, mode: 'insensitive' } },
          { employee: { firstName: { contains: filters.q, mode: 'insensitive' } } },
          { employee: { lastName: { contains: filters.q, mode: 'insensitive' } } },
          { employee: { code: { contains: filters.q, mode: 'insensitive' } } },
        ]
      : undefined,
    AND: managerScope ? [managerScope] : undefined,
  };
}

function assertManagerCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasRole(session, ['Management', 'Admin', 'Super Admin'])) {
    return session;
  }
  throw new ForbiddenError('Only Management can review this confirmation');
}

function getNextConfirmationStatusOnSubmit(
  confirmation: Pick<
    ConfirmationRecord,
    'status' | 'managerReviewStatus' | 'hrReviewStatus' | 'accountsReviewStatus'
  >,
) {
  if (confirmation.status !== 'SENT_BACK') {
    return 'PENDING_HR_APPROVAL';
  }

  if (confirmation.accountsReviewStatus === 'REVISION_REQUESTED') {
    return 'PENDING_ACCOUNTS_APPROVAL';
  }

  if (confirmation.hrReviewStatus === 'SENT_BACK') {
    return 'PENDING_HR_APPROVAL';
  }

  return 'PENDING_MANAGER_APPROVAL';
}

async function assertConfirmationTableAvailable() {
  const available = await isConfirmationTableAvailable();
  if (!available) {
    throw new ValidationError(CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE);
  }
}

async function finalizeConfirmationInTx(
  tx: Prisma.TransactionClient,
  confirmation: ConfirmationRecord,
  actorUserId?: string | null,
) {
  const salaryUpdated = confirmation.salaryRevisionRequired && confirmation.newBasicSalary.gt(confirmation.currentBasicSalary);

  await tx.employee.update({
    where: { id: confirmation.employeeId },
    data: {
      employmentType: 'PERMANENT',
      status: 'ACTIVE',
      basicSalary: salaryUpdated ? confirmation.newBasicSalary : undefined,
      updatedById: actorUserId ?? confirmation.updatedById ?? confirmation.createdById ?? null,
    },
  });

  if (salaryUpdated) {
    await tx.contract.updateMany({
      where: {
        employeeId: confirmation.employeeId,
        status: { in: ['ACTIVE', 'SIGNED', 'WAITING_FOR_JOINING'] },
      },
      data: {
        basicSalary: confirmation.newBasicSalary,
        updatedById: actorUserId ?? confirmation.updatedById ?? confirmation.createdById ?? null,
      },
    });

    await tx.employeeSalaryHistory.create({
      data: {
        branchId: confirmation.branchId,
        employeeId: confirmation.employeeId,
        sourceType: 'CONFIRMATION',
        sourceId: confirmation.id,
        effectiveDate: confirmation.effectiveDate,
        oldBasicSalary: confirmation.currentBasicSalary,
        newBasicSalary: confirmation.newBasicSalary,
        oldGrossSalary: confirmation.currentGrossSalary,
        newGrossSalary: confirmation.newGrossSalary,
        remarks: confirmation.remarks ?? confirmation.reason,
        appliedAt: new Date(),
        createdById: actorUserId ?? confirmation.updatedById ?? confirmation.createdById ?? null,
        updatedById: actorUserId ?? confirmation.updatedById ?? confirmation.createdById ?? null,
      },
    });
  }

  return tx.employeeConfirmation.update({
    where: { id: confirmation.id },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      completedAt: new Date(),
      letterGeneratedAt: new Date(),
      updatedById: actorUserId ?? confirmation.updatedById ?? confirmation.createdById ?? null,
    },
    include: confirmationIncludes,
  });
}

export async function isConfirmationTableAvailable(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    confirmationTableAvailabilityCache &&
    now - confirmationTableAvailabilityCache.checkedAt < CONFIRMATION_TABLE_CACHE_TTL_MS
  ) {
    return confirmationTableAvailabilityCache.available;
  }

  const rows = await prisma.$queryRaw<Array<{ exists: number } | { exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'EmployeeConfirmation'
    ) AS "exists"
  `;

  const available = Boolean(rows[0]?.exists);
  confirmationTableAvailabilityCache = { checkedAt: now, available };
  return available;
}

export const confirmationsService = {
  async list(
    session: AppSession | null,
    filters: {
      branchId?: string;
      employeeId?: string;
      status?: string;
      confirmationType?: string;
      q?: string;
    } = {},
  ) {
    const actor = assertCanReadConfirmationModule(session);
    await assertConfirmationTableAvailable();
    return prisma.employeeConfirmation.findMany({
      where: getScopedConfirmationWhere(actor, filters),
      include: confirmationIncludes,
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    const actor = assertCanReadConfirmationModule(session);
    await assertConfirmationTableAvailable();
    const record = await prisma.employeeConfirmation.findFirst({
      where: {
        id,
        ...(hasConfirmationElevatedAccess(actor)
          ? {}
          : {
              OR: [
                { createdById: actor.userId },
                { reportingManager: { user: { id: actor.userId } } },
              ],
            }),
      },
      include: confirmationIncludes,
    });
    if (!record) throw new NotFoundError('Confirmation not found');
    return record;
  },

  async create(session: AppSession | null, input: ConfirmationCreateInput) {
    const actor = assertHrCanWrite(session);
    await assertConfirmationTableAvailable();

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, reportingManager: { include: { user: true } } },
    });
    if (!employee) throw new NotFoundError('Employee not found');
    if (!['PROBATION', 'INTERN'].includes(employee.employmentType ?? '')) {
      throw new ValidationError('Only probation or intern employees can be confirmed');
    }

    const currentGrossSalary = computeGrossSalary(employee);
    const incrementAmount = normalizeIncrementAmount(input.incrementAmount);
    const newBasicSalary = Boolean(input.salaryRevisionRequired)
      ? employee.basicSalary.add(incrementAmount)
      : employee.basicSalary;
    const newGrossSalary = Boolean(input.salaryRevisionRequired)
      ? currentGrossSalary.add(incrementAmount)
      : currentGrossSalary;
    const confirmationNumber = await nextConfirmationNumber(input.effectiveDate);

    const record = await prisma.$transaction(async (tx) =>
      tx.employeeConfirmation.create({
        data: {
          confirmationNumber,
          branchId: employee.branchId,
          employeeId: employee.id,
          confirmationType: input.confirmationType,
          currentBranch: employee.branch.name,
          currentDepartment: employee.department ?? null,
          currentDesignation: employee.designation ?? null,
          currentEmploymentType: employee.employmentType ?? null,
          currentBasicSalary: employee.basicSalary,
          currentGrossSalary: currentGrossSalary,
          reportingManagerId: employee.reportingManagerId ?? null,
          probationEndDate: input.probationEndDate === '' ? null : input.probationEndDate ?? null,
          effectiveDate: input.effectiveDate,
          salaryRevisionRequired: Boolean(input.salaryRevisionRequired),
          incrementAmount: Boolean(input.salaryRevisionRequired) ? incrementAmount : null,
          newBasicSalary,
          newGrossSalary,
          benefitsRevision: input.benefitsRevision || null,
          reason: input.reason,
          performanceSummary: input.performanceSummary || null,
          remarks: input.remarks || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
        include: confirmationIncludes,
      }),
    );

    return record;
  },

  async update(session: AppSession | null, input: ConfirmationUpdateInput) {
    const actor = assertHrCanWrite(session);
    await assertConfirmationTableAvailable();

    const existing = await prisma.employeeConfirmation.findUnique({
      where: { id: input.id },
      include: { reportingManager: { select: { user: { select: { id: true } } } } },
    });
    if (!existing) throw new NotFoundError('Confirmation not found');
    if (!['DRAFT', 'SENT_BACK'].includes(existing.status)) {
      throw new ValidationError('Only draft or sent-back confirmations can be edited');
    }

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, reportingManager: { include: { user: true } } },
    });
    if (!employee) throw new NotFoundError('Employee not found');

    const currentGrossSalary = computeGrossSalary(employee);
    const incrementAmount = normalizeIncrementAmount(input.incrementAmount);
    const newBasicSalary = Boolean(input.salaryRevisionRequired)
      ? employee.basicSalary.add(incrementAmount)
      : employee.basicSalary;
    const newGrossSalary = Boolean(input.salaryRevisionRequired)
      ? currentGrossSalary.add(incrementAmount)
      : currentGrossSalary;

    return prisma.employeeConfirmation.update({
      where: { id: input.id },
      data: {
        branchId: employee.branchId,
        employeeId: employee.id,
        confirmationType: input.confirmationType,
        currentBranch: employee.branch.name,
        currentDepartment: employee.department ?? null,
        currentDesignation: employee.designation ?? null,
        currentEmploymentType: employee.employmentType ?? null,
        currentBasicSalary: employee.basicSalary,
        currentGrossSalary: currentGrossSalary,
        reportingManagerId: employee.reportingManagerId ?? null,
        probationEndDate: input.probationEndDate === '' ? null : input.probationEndDate ?? null,
        effectiveDate: input.effectiveDate,
        salaryRevisionRequired: Boolean(input.salaryRevisionRequired),
        incrementAmount: Boolean(input.salaryRevisionRequired) ? incrementAmount : null,
        newBasicSalary,
        newGrossSalary,
        benefitsRevision: input.benefitsRevision || null,
        reason: input.reason,
        performanceSummary: input.performanceSummary || null,
        remarks: input.remarks || null,
        updatedById: actor.userId,
      },
      include: confirmationIncludes,
    });
  },

  async changeStatus(session: AppSession | null, input: ConfirmationStatusActionInput) {
    await assertConfirmationTableAvailable();
    const confirmation = await prisma.employeeConfirmation.findUnique({
      where: { id: input.id },
      include: confirmationIncludes,
    });
    if (!confirmation) throw new NotFoundError('Confirmation not found');

    const validTransitions: Record<string, string[]> = {
      submit: ['DRAFT', 'SENT_BACK'],
      manager_approve: ['PENDING_MANAGER_APPROVAL'],
      manager_reject: ['PENDING_MANAGER_APPROVAL'],
      manager_send_back: ['PENDING_MANAGER_APPROVAL'],
      manager_extend: ['PENDING_MANAGER_APPROVAL'],
      hr_approve: ['PENDING_HR_APPROVAL'],
      hr_reject: ['PENDING_HR_APPROVAL'],
      hr_send_back: ['PENDING_HR_APPROVAL'],
      hr_extend: ['PENDING_HR_APPROVAL'],
      accounts_approve: ['PENDING_ACCOUNTS_APPROVAL'],
      accounts_reject: ['PENDING_ACCOUNTS_APPROVAL'],
      accounts_request_revision: ['PENDING_ACCOUNTS_APPROVAL'],
      cancel: ['DRAFT', 'SENT_BACK'],
    };

    const allowed = validTransitions[input.action];
    if (!allowed?.includes(confirmation.status)) {
      throw new ValidationError(`Cannot ${input.action} a confirmation in ${confirmation.status} status`);
    }

    let actor: AppSession;
    switch (input.action) {
      case 'submit':
      case 'cancel':
        actor = assertHrCanWrite(session);
        break;
      case 'manager_approve':
      case 'manager_reject':
      case 'manager_send_back':
      case 'manager_extend':
        actor = assertManagerCanReview(session);
        break;
      case 'hr_approve':
      case 'hr_reject':
      case 'hr_send_back':
      case 'hr_extend':
        actor = assertHrCanReview(session);
        break;
      case 'accounts_approve':
      case 'accounts_reject':
      case 'accounts_request_revision':
        actor = assertAccountsCanReview(session);
        break;
      default:
        throw new ValidationError('Unsupported action');
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: Prisma.EmployeeConfirmationUpdateInput = {
        updatedById: actor.userId,
      };

      if (input.action === 'submit') {
        const nextStatus = getNextConfirmationStatusOnSubmit(confirmation);
        updateData.status = nextStatus;
        if (nextStatus === 'PENDING_MANAGER_APPROVAL') {
          updateData.managerReviewStatus = 'PENDING';
          updateData.managerReviewDate = null;
          updateData.managerRemarks = null;
          updateData.hrReviewStatus = 'PENDING';
          updateData.hrReviewDate = null;
          updateData.hrRemarks = null;
          updateData.accountsReviewStatus = 'PENDING';
          updateData.accountsReviewDate = null;
          updateData.accountsRemarks = null;
        } else if (nextStatus === 'PENDING_HR_APPROVAL') {
          updateData.hrReviewStatus = 'PENDING';
          updateData.hrReviewDate = null;
          updateData.hrRemarks = null;
          updateData.accountsReviewStatus = 'PENDING';
          updateData.accountsReviewDate = null;
          updateData.accountsRemarks = null;
        } else if (nextStatus === 'PENDING_ACCOUNTS_APPROVAL') {
          updateData.accountsReviewStatus = 'PENDING';
          updateData.accountsReviewDate = null;
          updateData.accountsRemarks = null;
        }
      } else if (input.action === 'manager_approve') {
        updateData.status = 'CONFIRMED';
        updateData.managerReviewStatus = 'APPROVED';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'manager_reject') {
        updateData.status = 'REJECTED';
        updateData.managerReviewStatus = 'REJECTED';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'manager_send_back') {
        updateData.status = 'SENT_BACK';
        updateData.managerReviewStatus = 'SENT_BACK';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'manager_extend') {
        updateData.status = 'EXTENDED';
        updateData.managerReviewStatus = 'EXTENDED';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'hr_approve') {
        updateData.hrReviewStatus = 'APPROVED';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
        updateData.status = confirmation.salaryRevisionRequired ? 'PENDING_ACCOUNTS_APPROVAL' : 'PENDING_MANAGER_APPROVAL';
      } else if (input.action === 'hr_reject') {
        updateData.status = 'REJECTED';
        updateData.hrReviewStatus = 'REJECTED';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'hr_send_back') {
        updateData.status = 'SENT_BACK';
        updateData.hrReviewStatus = 'SENT_BACK';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'hr_extend') {
        updateData.status = 'EXTENDED';
        updateData.hrReviewStatus = 'EXTENDED';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'accounts_approve') {
        updateData.accountsReviewStatus = 'APPROVED';
        updateData.accountsReviewDate = now;
        updateData.accountsRemarks = input.note || null;
        updateData.status = 'PENDING_MANAGER_APPROVAL';
      } else if (input.action === 'accounts_reject') {
        updateData.status = 'REJECTED';
        updateData.accountsReviewStatus = 'REJECTED';
        updateData.accountsReviewDate = now;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'accounts_request_revision') {
        updateData.status = 'SENT_BACK';
        updateData.accountsReviewStatus = 'REVISION_REQUESTED';
        updateData.accountsReviewDate = now;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'cancel') {
        updateData.status = 'CANCELLED';
      }

      let updated = await tx.employeeConfirmation.update({
        where: { id: confirmation.id },
        data: updateData,
        include: confirmationIncludes,
      });

      if (input.action === 'manager_approve') {
        updated = await finalizeConfirmationInTx(tx, updated, actor.userId);
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: confirmation.branchId,
          module: 'hr',
          action: `confirmation-${input.action}`,
          entityType: 'EmployeeConfirmation',
          entityId: confirmation.id,
          before: { status: confirmation.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });

    if (input.action === 'submit') {
      await publishToPermission('hr:write', {
        branchId: confirmation.branchId,
        module: 'hr',
        title: `Confirmation review needed: ${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
        body: confirmationDetailText(confirmation),
        href: '/hr/confirmations',
      });
    }

    if (input.action === 'hr_approve' && confirmation.salaryRevisionRequired) {
      await publishToPermission('accounts:post', {
        branchId: confirmation.branchId,
        module: 'hr',
        title: `Accounts verification needed: ${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
        body: confirmationDetailText(confirmation),
        href: '/hr/confirmations',
      });
    }

    if (
      (input.action === 'hr_approve' && !confirmation.salaryRevisionRequired) ||
      input.action === 'accounts_approve'
    ) {
      const managementUsers = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: {
            some: {
              role: {
                name: { in: ['Management', 'Admin', 'Super Admin'] },
              },
            },
          },
        },
        select: { id: true },
      });

      for (const user of managementUsers) {
        await publishNotification({
          recipientId: user.id,
          branchId: confirmation.branchId,
          module: 'hr',
          title: `Final confirmation approval needed: ${confirmation.employee.firstName} ${confirmation.employee.lastName}`,
          body: confirmationDetailText(confirmation),
          href: '/hr/confirmations',
        });
      }
    }

    if (input.action === 'manager_approve') {
      if (confirmation.employee.user?.id) {
        await publishNotification({
          recipientId: confirmation.employee.user.id,
          branchId: confirmation.branchId,
          module: 'hr',
          title: 'Employment confirmation completed',
          body: confirmationDetailText(result),
          href: '/hr/confirmations',
        });
      }
      if (confirmation.createdById) {
        await publishNotification({
          recipientId: confirmation.createdById,
          branchId: confirmation.branchId,
          module: 'hr',
          title: 'Confirmation request completed',
          body: confirmationDetailText(result),
          href: '/hr/confirmations',
        });
      }
    }

    if (
      [
        'manager_reject',
        'manager_send_back',
        'manager_extend',
        'hr_reject',
        'hr_send_back',
        'hr_extend',
        'accounts_reject',
        'accounts_request_revision',
      ].includes(input.action) &&
      confirmation.createdById
    ) {
      await publishNotification({
        recipientId: confirmation.createdById,
        branchId: confirmation.branchId,
        severity: ['manager_reject', 'hr_reject', 'accounts_reject'].includes(input.action) ? 'WARNING' : 'INFO',
        module: 'hr',
        title: 'Confirmation request updated',
        body: input.note || confirmationDetailText(confirmation),
        href: '/hr/confirmations',
      });
    }

    return result;
  },

  async countByStatus(session: AppSession | null, branchId?: string) {
    const actor = assertCanReadConfirmationModule(session);
    await assertConfirmationTableAvailable();
    const counts = await prisma.employeeConfirmation.groupBy({
      by: ['status'],
      where: getScopedConfirmationWhere(actor, { branchId }),
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const row of counts) result[row.status] = row._count;
    return result;
  },
};

export async function syncConfirmationReportingManagerForEmployee(employeeId: string, reportingManagerId: string) {
  const confirmations = await prisma.employeeConfirmation.findMany({
    where: {
      employeeId,
      status: { in: ['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'SENT_BACK'] },
      reportingManagerId: { not: reportingManagerId },
    },
    include: confirmationIncludes,
  });

  if (confirmations.length === 0) return;

  await prisma.employeeConfirmation.updateMany({
    where: { id: { in: confirmations.map((record) => record.id) } },
    data: { reportingManagerId },
  });
}
