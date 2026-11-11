import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification, publishToPermission } from '@/server/notifications/publisher';
import type { AppSession } from '@/server/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import {
  EXIT_ASSETS,
  EXIT_DEPARTMENTS,
  type ExitClearanceStatusActionInput,
  type ExitClearanceUpsertInput,
  EXIT_SYSTEM_ACCESS_ITEMS,
  type ResignationCreateInput,
  type ResignationStatusActionInput,
  type ResignationUpdateInput,
} from '@/server/validators/resignations';

const ZERO = new Prisma.Decimal(0);
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export const RESIGNATION_TABLE_UNAVAILABLE_MESSAGE =
  'Resignations and exit clearances are not available yet because the required HR separation tables have not been migrated in this database.';
const TABLE_CACHE_TTL_MS = 60_000;
const REQUIRED_TABLES = [
  'EmployeeResignation',
  'EmployeeExitClearance',
  'EmployeeExitDepartmentClearance',
  'EmployeeExitAssetReturn',
  'EmployeeExitSystemAccess',
  'EmployeeExitAccountsSettlement',
  'EmployeeExitInterview',
] as const;
const DEPARTMENT_REVIEW_KEYS: Set<string> = new Set(
  EXIT_DEPARTMENTS.filter((item) => !['ACCOUNTS', 'HR'].includes(item.key)).map((item) => item.key),
);

let resignationTableAvailabilityCache:
  | {
      checkedAt: number;
      available: boolean;
    }
  | undefined;

export function isEmployeeResignationTableMissingError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const table = String((error as { meta?: { table?: string } } | null)?.meta?.table ?? '');
  return code === 'P2021' && REQUIRED_TABLES.some((required) => table.includes(required));
}

function hasRole(session: AppSession | null, roles: string[]) {
  return roles.some((role) => session?.roles.includes(role));
}

function hasPermission(session: AppSession | null, permission: string) {
  return session?.permissions.includes(permission) ?? false;
}

function hasResignationAccess(session: AppSession | null) {
  if (!session) return false;
  return (
    hasPermission(session, 'hr:read') ||
    hasPermission(session, 'accounts:read') ||
    hasPermission(session, 'accounts:post') ||
    hasRole(session, ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'])
  );
}

function assertCanReadResignationModule(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasResignationAccess(session)) return session;
  throw new ForbiddenError('Missing permission: hr:read or accounts:read');
}

function assertHrCanWrite(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'hr:write') || hasRole(session, ['HR', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only HR can manage resignations and exit clearances');
}

function assertManagementCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasRole(session, ['Management', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only Management can review this resignation');
}

function assertAccountsCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasPermission(session, 'accounts:post') || hasRole(session, ['Accounts', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only Accounts can review this step');
}

function assertDepartmentCanReview(session: AppSession | null) {
  if (!session) throw new UnauthorizedError();
  if (hasRole(session, ['Management', 'HR', 'Admin', 'Super Admin'])) return session;
  throw new ForbiddenError('Only department approvers can review this step');
}

const resignationIncludes = {
  branch: { select: { id: true, code: true, name: true } },
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
      status: true,
      user: { select: { id: true } },
      reportingManager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  reportingManager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  exitClearance: {
    select: {
      id: true,
      clearanceNumber: true,
      status: true,
    },
  },
} as const;

const exitClearanceIncludes = {
  branch: { select: { id: true, code: true, name: true } },
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
      status: true,
      user: { select: { id: true } },
      reportingManager: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  resignation: {
    select: {
      id: true,
      resignationNumber: true,
      resignationDate: true,
      lastWorkingDate: true,
      reason: true,
      status: true,
      settlementRequired: true,
    },
  },
  departments: { orderBy: { sortOrder: 'asc' } },
  assets: { orderBy: { sortOrder: 'asc' } },
  systemAccess: true,
  settlement: true,
  interview: true,
} as const;

type ResignationRecord = Prisma.EmployeeResignationGetPayload<{ include: typeof resignationIncludes }>;
type ExitClearanceRecord = Prisma.EmployeeExitClearanceGetPayload<{ include: typeof exitClearanceIncludes }>;

function getResignationWhere(
  session: AppSession,
  filters: {
    branchId?: string;
    employeeId?: string;
    status?: string;
    q?: string;
  } = {},
): Prisma.EmployeeResignationWhereInput {
  return {
    branchId: filters.branchId,
    employeeId: filters.employeeId,
    status: filters.status as never,
    OR: filters.q
      ? [
          { resignationNumber: { contains: filters.q } },
          { employee: { firstName: { contains: filters.q } } },
          { employee: { lastName: { contains: filters.q } } },
          { employee: { code: { contains: filters.q } } },
        ]
      : undefined,
    AND: hasResignationAccess(session) ? undefined : [{ createdById: session.userId }],
  };
}

function getExitClearanceWhere(
  session: AppSession,
  filters: {
    branchId?: string;
    status?: string;
    q?: string;
  } = {},
): Prisma.EmployeeExitClearanceWhereInput {
  return {
    branchId: filters.branchId,
    status: filters.status as never,
    OR: filters.q
      ? [
          { clearanceNumber: { contains: filters.q } },
          { resignation: { resignationNumber: { contains: filters.q } } },
          { employee: { firstName: { contains: filters.q } } },
          { employee: { lastName: { contains: filters.q } } },
          { employee: { code: { contains: filters.q } } },
        ]
      : undefined,
    AND: hasResignationAccess(session) ? undefined : [{ createdById: session.userId }],
  };
}

function normalizeMoney(value: number | '' | undefined) {
  if (value === '' || value == null) return ZERO;
  return D(value);
}

function computeSettlementDetails(input: {
  buyoutAmount?: number | '';
  pendingSalary?: number | '';
  leaveEncashment?: number | '';
  bonus?: number | '';
  overtime?: number | '';
  gratuity?: number | '';
  loanDeduction?: number | '';
  advanceDeduction?: number | '';
  taxDeduction?: number | '';
}) {
  const buyoutAmount = normalizeMoney(input.buyoutAmount);
  const pendingSalary = normalizeMoney(input.pendingSalary);
  const leaveEncashment = normalizeMoney(input.leaveEncashment);
  const bonus = normalizeMoney(input.bonus);
  const overtime = normalizeMoney(input.overtime);
  const gratuity = normalizeMoney(input.gratuity);
  const loanDeduction = normalizeMoney(input.loanDeduction);
  const advanceDeduction = normalizeMoney(input.advanceDeduction);
  const taxDeduction = normalizeMoney(input.taxDeduction);

  const earnings = pendingSalary.add(leaveEncashment).add(bonus).add(overtime).add(gratuity);
  const deductions = buyoutAmount.add(loanDeduction).add(advanceDeduction).add(taxDeduction);
  const finalPayable = earnings.sub(deductions);
  const settlementRequired =
    !buyoutAmount.eq(ZERO) ||
    !pendingSalary.eq(ZERO) ||
    !leaveEncashment.eq(ZERO) ||
    !bonus.eq(ZERO) ||
    !overtime.eq(ZERO) ||
    !loanDeduction.eq(ZERO) ||
    !advanceDeduction.eq(ZERO) ||
    !taxDeduction.eq(ZERO) ||
    !gratuity.eq(ZERO);

  return {
    buyoutAmount,
    pendingSalary,
    leaveEncashment,
    bonus,
    overtime,
    loanDeduction,
    advanceDeduction,
    taxDeduction,
    gratuity,
    finalPayable,
    settlementRequired,
  };
}

function computeExitNetPayable(input: {
  pendingSalary: number;
  leaveEncashment: number;
  bonus: number;
  overtime: number;
  gratuity: number;
  loanRecovery: number;
  advanceRecovery: number;
  assetDamageRecovery: number;
  noticePay: number;
  taxDeduction: number;
  otherDeduction: number;
}) {
  const earnings = D(input.pendingSalary).add(input.leaveEncashment).add(input.bonus).add(input.overtime).add(input.gratuity);
  const deductions = D(input.loanRecovery)
    .add(input.advanceRecovery)
    .add(input.assetDamageRecovery)
    .add(input.noticePay)
    .add(input.taxDeduction)
    .add(input.otherDeduction);
  return earnings.sub(deductions);
}

function resignationDetailText(record: {
  resignationNumber: string;
  lastWorkingDate: Date;
  finalPayable: Prisma.Decimal;
  settlementRequired: boolean;
}) {
  return `${record.resignationNumber} · last working ${record.lastWorkingDate.toISOString().slice(0, 10)}${
    record.settlementRequired ? ` · payable ${record.finalPayable.toString()}` : ''
  }`;
}

function defaultDepartmentRows(record: ResignationRecord) {
  const reportingManagerName = record.reportingManager
    ? `${record.reportingManager.firstName} ${record.reportingManager.lastName}`
    : '';
  return EXIT_DEPARTMENTS.map((item) => ({
    departmentKey: item.key,
    departmentName: item.label,
    responsiblePerson:
      item.key === 'REPORTING_MANAGER'
        ? reportingManagerName
        : item.roleLabel,
    status: 'PENDING' as const,
    remarks: null,
    sortOrder: item.sortOrder,
  }));
}

function defaultAssetRows() {
  return EXIT_ASSETS.map((item) => ({
    assetKey: item.key,
    assetName: item.label,
    returned: false,
    condition: 'GOOD' as const,
    deductionAmount: ZERO,
    remarks: null,
    sortOrder: item.sortOrder,
  }));
}

function mapDepartmentRows(
  clearanceId: string,
  existing: ExitClearanceRecord['departments'],
  input: ExitClearanceUpsertInput['departments'],
) {
  return EXIT_DEPARTMENTS.map((item) => {
    const current = input.find((row) => row.departmentKey === item.key);
    const prior = existing.find((row) => row.departmentKey === item.key);
    return {
      where: {
        clearanceId_departmentKey: {
          clearanceId,
          departmentKey: item.key,
        },
      },
      update: {
        departmentName: item.label,
        responsiblePerson: current?.responsiblePerson || null,
        status: current?.status ?? prior?.status ?? 'PENDING',
        remarks: current?.remarks || null,
        sortOrder: item.sortOrder,
      },
      create: {
        departmentKey: item.key,
        departmentName: item.label,
        responsiblePerson: current?.responsiblePerson || null,
        status: current?.status ?? 'PENDING',
        remarks: current?.remarks || null,
        sortOrder: item.sortOrder,
      },
    };
  });
}

function mapAssetRows(
  clearanceId: string,
  existing: ExitClearanceRecord['assets'],
  input: ExitClearanceUpsertInput['assets'],
) {
  return EXIT_ASSETS.map((item) => {
    const current = input.find((row) => row.assetKey === item.key);
    const prior = existing.find((row) => row.assetKey === item.key);
    return {
      where: {
        clearanceId_assetKey: {
          clearanceId,
          assetKey: item.key,
        },
      },
      update: {
        assetName: item.label,
        returned: current?.returned ?? prior?.returned ?? false,
        condition: current?.condition ?? prior?.condition ?? 'GOOD',
        deductionAmount: D(current?.deductionAmount ?? prior?.deductionAmount ?? 0),
        remarks: current?.remarks || null,
        sortOrder: item.sortOrder,
      },
      create: {
        assetKey: item.key,
        assetName: item.label,
        returned: current?.returned ?? false,
        condition: current?.condition ?? 'GOOD',
        deductionAmount: D(current?.deductionAmount ?? 0),
        remarks: current?.remarks || null,
        sortOrder: item.sortOrder,
      },
    };
  });
}

function areAllDepartmentRowsCleared(rows: Array<{ departmentKey: string; status: string }>) {
  return rows
    .filter((row) => DEPARTMENT_REVIEW_KEYS.has(row.departmentKey))
    .every((row) => ['APPROVED', 'NOT_REQUIRED'].includes(row.status));
}

function areAllSystemAccessItemsDone(access: ExitClearanceRecord['systemAccess']) {
  if (!access) return false;
  return EXIT_SYSTEM_ACCESS_ITEMS.every((item) => Boolean(access[item.key]));
}

async function nextResignationNumber(resignationDate: Date) {
  const year = resignationDate.getUTCFullYear();
  const prefix = `RES-${year}-`;
  const last = await prisma.employeeResignation.findFirst({
    where: { resignationNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { resignationNumber: true },
  });
  const lastSeq = last ? parseInt(last.resignationNumber.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
}

async function nextExitClearanceNumber(lastWorkingDate: Date) {
  const year = lastWorkingDate.getUTCFullYear();
  const prefix = `EC-${year}-`;
  const last = await prisma.employeeExitClearance.findFirst({
    where: { clearanceNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { clearanceNumber: true },
  });
  const lastSeq = last ? parseInt(last.clearanceNumber.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
}

async function getLatestConfirmationDate(employeeId: string) {
  try {
    const latest = await prisma.employeeConfirmation.findFirst({
      where: { employeeId, status: 'CONFIRMED' },
      orderBy: { confirmedAt: 'desc' },
      select: { confirmedAt: true },
    });
    return latest?.confirmedAt ?? null;
  } catch {
    return null;
  }
}

async function assertResignationTablesAvailable() {
  const available = await isResignationTableAvailable();
  if (!available) {
    throw new ValidationError(RESIGNATION_TABLE_UNAVAILABLE_MESSAGE);
  }
}

async function ensureExitClearanceForResignation(
  tx: Prisma.TransactionClient,
  resignation: ResignationRecord,
  actorUserId: string,
) {
  const existing = await tx.employeeExitClearance.findUnique({
    where: { resignationId: resignation.id },
    include: exitClearanceIncludes,
  });
  if (existing) return existing;

  const clearanceNumber = await nextExitClearanceNumber(resignation.lastWorkingDate);
  const settlement = computeExitNetPayable({
    pendingSalary: Number(resignation.pendingSalary),
    leaveEncashment: Number(resignation.leaveEncashment),
    bonus: Number(resignation.bonus),
    overtime: Number(resignation.overtime),
    gratuity: Number(resignation.gratuity),
    loanRecovery: Number(resignation.loanDeduction),
    advanceRecovery: Number(resignation.advanceDeduction),
    assetDamageRecovery: 0,
    noticePay: Number(resignation.buyoutAmount ?? 0),
    taxDeduction: Number(resignation.taxDeduction),
    otherDeduction: 0,
  });

  return tx.employeeExitClearance.create({
    data: {
      clearanceNumber,
      resignationId: resignation.id,
      branchId: resignation.branchId,
      employeeId: resignation.employeeId,
      exitType: resignation.resignationType === 'RETIREMENT' ? 'RETIREMENT' : 'RESIGNATION',
      status: 'DRAFT',
      lastWorkingDate: resignation.lastWorkingDate,
      reasonForExit: resignation.reason,
      noticePeriodServed: resignation.noticeRequired ? resignation.noticeServedDays >= resignation.noticePeriodDays : true,
      handoverCompleted: Boolean(resignation.handoverStatus),
      replacementAssigned: Boolean(resignation.replacementNeeded),
      hrRemarks: resignation.hrRemarks,
      createdById: actorUserId,
      updatedById: actorUserId,
      departments: {
        create: defaultDepartmentRows(resignation),
      },
      assets: {
        create: defaultAssetRows(),
      },
      systemAccess: {
        create: {},
      },
      settlement: {
        create: {
          pendingSalary: resignation.pendingSalary,
          leaveEncashment: resignation.leaveEncashment,
          bonus: resignation.bonus,
          overtime: resignation.overtime,
          loanRecovery: resignation.loanDeduction,
          advanceRecovery: resignation.advanceDeduction,
          noticePay: resignation.buyoutAmount ?? ZERO,
          gratuity: resignation.gratuity,
          taxDeduction: resignation.taxDeduction,
          assetDamageRecovery: ZERO,
          otherDeduction: ZERO,
          netPayable: settlement,
        },
      },
      interview: {
        create: {},
      },
    },
    include: exitClearanceIncludes,
  });
}

export async function isResignationTableAvailable(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    resignationTableAvailabilityCache &&
    now - resignationTableAvailabilityCache.checkedAt < TABLE_CACHE_TTL_MS
  ) {
    return resignationTableAvailabilityCache.available;
  }

  let available = true;
  try {
    await Promise.all([
      prisma.employeeResignation.findFirst({ select: { id: true } }),
      prisma.employeeExitClearance.findFirst({ select: { id: true } }),
      prisma.employeeExitDepartmentClearance.findFirst({ select: { id: true } }),
      prisma.employeeExitAssetReturn.findFirst({ select: { id: true } }),
      prisma.employeeExitSystemAccess.findFirst({ select: { id: true } }),
      prisma.employeeExitAccountsSettlement.findFirst({ select: { id: true } }),
      prisma.employeeExitInterview.findFirst({ select: { id: true } }),
    ]);
  } catch (error) {
    if (!isEmployeeResignationTableMissingError(error)) throw error;
    available = false;
  }

  resignationTableAvailabilityCache = { checkedAt: now, available };
  return available;
}

export const resignationsService = {
  async list(
    session: AppSession | null,
    filters: {
      branchId?: string;
      employeeId?: string;
      status?: string;
      q?: string;
    } = {},
  ) {
    const actor = assertCanReadResignationModule(session);
    await assertResignationTablesAvailable();
    return prisma.employeeResignation.findMany({
      where: getResignationWhere(actor, filters),
      include: resignationIncludes,
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    const actor = assertCanReadResignationModule(session);
    await assertResignationTablesAvailable();
    const record = await prisma.employeeResignation.findFirst({
      where: { id, ...getResignationWhere(actor) },
      include: resignationIncludes,
    });
    if (!record) throw new NotFoundError('Resignation not found');
    return record;
  },

  async create(session: AppSession | null, input: ResignationCreateInput) {
    const actor = assertHrCanWrite(session);
    await assertResignationTablesAvailable();
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        reportingManager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!employee) throw new NotFoundError('Employee not found');

    const settlement = computeSettlementDetails(input);
    const confirmationDate = await getLatestConfirmationDate(employee.id);
    const resignationNumber = await nextResignationNumber(input.resignationDate);

    return prisma.employeeResignation.create({
      data: {
        resignationNumber,
        branchId: employee.branchId,
        employeeId: employee.id,
        reportingManagerId: employee.reportingManagerId,
        resignationType: input.resignationType,
        currentDepartment: employee.department,
        currentDesignation: employee.designation,
        currentEmploymentType: employee.employmentType,
        currentEmployeeStatus: employee.status,
        joiningDate: employee.joinedAt,
        confirmationDate,
        resignationDate: input.resignationDate,
        lastWorkingDate: input.lastWorkingDate,
        noticeRequired: input.noticeRequired,
        noticePeriodDays: input.noticePeriodDays,
        noticeServedDays: input.noticeServedDays === '' || input.noticeServedDays == null ? 0 : Number(input.noticeServedDays),
        noticeWaived: input.noticeWaived,
        buyoutAmount: settlement.buyoutAmount,
        reason: input.reason,
        employeeRemarks: input.employeeRemarks || null,
        attachmentUrl: input.attachmentUrl || null,
        managerPerformance: input.managerPerformance || null,
        currentProjects: input.currentProjects || null,
        handoverStatus: input.handoverStatus || null,
        replacementNeeded: input.replacementNeeded,
        assetsReturned: input.assetsReturned,
        managerRecommendation: input.managerRecommendation || null,
        attendanceVerified: input.attendanceVerified,
        leaveBalanceVerified: input.leaveBalanceVerified,
        noticePeriodVerified: input.noticePeriodVerified,
        documentsVerified: input.documentsVerified,
        policyVerified: input.policyVerified,
        pendingSalary: settlement.pendingSalary,
        leaveEncashment: settlement.leaveEncashment,
        bonus: settlement.bonus,
        overtime: settlement.overtime,
        loanDeduction: settlement.loanDeduction,
        advanceDeduction: settlement.advanceDeduction,
        taxDeduction: settlement.taxDeduction,
        gratuity: settlement.gratuity,
        finalPayable: settlement.finalPayable,
        settlementRequired: settlement.settlementRequired,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
      include: resignationIncludes,
    });
  },

  async update(session: AppSession | null, input: ResignationUpdateInput) {
    const actor = assertHrCanWrite(session);
    await assertResignationTablesAvailable();
    const current = await prisma.employeeResignation.findUnique({
      where: { id: input.id },
      include: resignationIncludes,
    });
    if (!current) throw new NotFoundError('Resignation not found');
    if (!['DRAFT', 'WITHDRAWN', 'REJECTED'].includes(current.status)) {
      throw new ValidationError('Only draft, withdrawn, or rejected resignations can be updated');
    }

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { reportingManager: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!employee) throw new NotFoundError('Employee not found');

    const settlement = computeSettlementDetails(input);
    const confirmationDate = await getLatestConfirmationDate(employee.id);

    return prisma.employeeResignation.update({
      where: { id: input.id },
      data: {
        employeeId: employee.id,
        reportingManagerId: employee.reportingManagerId,
        resignationType: input.resignationType,
        currentDepartment: employee.department,
        currentDesignation: employee.designation,
        currentEmploymentType: employee.employmentType,
        currentEmployeeStatus: employee.status,
        joiningDate: employee.joinedAt,
        confirmationDate,
        resignationDate: input.resignationDate,
        lastWorkingDate: input.lastWorkingDate,
        noticeRequired: input.noticeRequired,
        noticePeriodDays: input.noticePeriodDays,
        noticeServedDays: input.noticeServedDays === '' || input.noticeServedDays == null ? 0 : Number(input.noticeServedDays),
        noticeWaived: input.noticeWaived,
        buyoutAmount: settlement.buyoutAmount,
        reason: input.reason,
        employeeRemarks: input.employeeRemarks || null,
        attachmentUrl: input.attachmentUrl || null,
        managerPerformance: input.managerPerformance || null,
        currentProjects: input.currentProjects || null,
        handoverStatus: input.handoverStatus || null,
        replacementNeeded: input.replacementNeeded,
        assetsReturned: input.assetsReturned,
        managerRecommendation: input.managerRecommendation || null,
        attendanceVerified: input.attendanceVerified,
        leaveBalanceVerified: input.leaveBalanceVerified,
        noticePeriodVerified: input.noticePeriodVerified,
        documentsVerified: input.documentsVerified,
        policyVerified: input.policyVerified,
        pendingSalary: settlement.pendingSalary,
        leaveEncashment: settlement.leaveEncashment,
        bonus: settlement.bonus,
        overtime: settlement.overtime,
        loanDeduction: settlement.loanDeduction,
        advanceDeduction: settlement.advanceDeduction,
        taxDeduction: settlement.taxDeduction,
        gratuity: settlement.gratuity,
        finalPayable: settlement.finalPayable,
        settlementRequired: settlement.settlementRequired,
        updatedById: actor.userId,
      },
      include: resignationIncludes,
    });
  },

  async changeStatus(session: AppSession | null, input: ResignationStatusActionInput) {
    await assertResignationTablesAvailable();
    const resignation = await prisma.employeeResignation.findUnique({
      where: { id: input.id },
      include: resignationIncludes,
    });
    if (!resignation) throw new NotFoundError('Resignation not found');

    const validTransitions: Record<string, string[]> = {
      submit: ['DRAFT', 'WITHDRAWN', 'REJECTED'],
      withdraw: ['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL'],
      cancel: ['DRAFT'],
      manager_approve: ['PENDING_MANAGER_APPROVAL'],
      manager_reject: ['PENDING_MANAGER_APPROVAL'],
      manager_send_back: ['PENDING_MANAGER_APPROVAL'],
      hr_approve: ['PENDING_HR_APPROVAL'],
      hr_reject: ['PENDING_HR_APPROVAL'],
      hr_hold: ['PENDING_HR_APPROVAL'],
      accounts_approve: ['PENDING_ACCOUNTS_APPROVAL'],
      accounts_reject: ['PENDING_ACCOUNTS_APPROVAL'],
      accounts_request_correction: ['PENDING_ACCOUNTS_APPROVAL'],
      generate_acceptance_letter: ['PENDING_EXIT_CLEARANCE', 'COMPLETED'],
      generate_experience_letter: ['PENDING_EXIT_CLEARANCE', 'COMPLETED'],
      generate_relieving_letter: ['PENDING_EXIT_CLEARANCE', 'COMPLETED'],
      archive_employee: ['COMPLETED'],
    };
    if (!validTransitions[input.action]?.includes(resignation.status)) {
      throw new ValidationError(`Cannot ${input.action} a resignation in ${resignation.status} status`);
    }

    let actor: AppSession;
    switch (input.action) {
      case 'submit':
      case 'withdraw':
      case 'cancel':
      case 'generate_acceptance_letter':
      case 'generate_experience_letter':
      case 'generate_relieving_letter':
      case 'archive_employee':
        actor = assertHrCanWrite(session);
        break;
      case 'manager_approve':
      case 'manager_reject':
      case 'manager_send_back':
        actor = assertManagementCanReview(session);
        break;
      case 'hr_approve':
      case 'hr_reject':
      case 'hr_hold':
        actor = assertHrCanWrite(session);
        break;
      case 'accounts_approve':
      case 'accounts_reject':
      case 'accounts_request_correction':
        actor = assertAccountsCanReview(session);
        break;
      default:
        throw new ValidationError('Unsupported action');
    }

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: Prisma.EmployeeResignationUpdateInput = { updatedById: actor.userId };

      if (input.action === 'submit') {
        updateData.status = 'PENDING_MANAGER_APPROVAL';
        updateData.managerReviewStatus = 'PENDING';
        updateData.managerReviewDate = null;
        updateData.managerRemarks = null;
        updateData.hrReviewStatus = 'PENDING';
        updateData.hrReviewDate = null;
        updateData.hrRemarks = null;
        updateData.accountsReviewStatus = 'PENDING';
        updateData.accountsReviewDate = null;
        updateData.accountsRemarks = null;
      } else if (input.action === 'withdraw') {
        updateData.status = 'WITHDRAWN';
      } else if (input.action === 'cancel') {
        updateData.status = 'CANCELLED';
      } else if (input.action === 'manager_approve') {
        updateData.status = 'PENDING_HR_APPROVAL';
        updateData.managerReviewStatus = 'APPROVED';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'manager_reject') {
        updateData.status = 'REJECTED';
        updateData.managerReviewStatus = 'REJECTED';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'manager_send_back') {
        updateData.status = 'DRAFT';
        updateData.managerReviewStatus = 'SENT_BACK';
        updateData.managerReviewDate = now;
        updateData.managerRemarks = input.note || null;
      } else if (input.action === 'hr_approve') {
        updateData.status = resignation.settlementRequired ? 'PENDING_ACCOUNTS_APPROVAL' : 'PENDING_EXIT_CLEARANCE';
        updateData.hrReviewStatus = 'APPROVED';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'hr_reject') {
        updateData.status = 'REJECTED';
        updateData.hrReviewStatus = 'REJECTED';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'hr_hold') {
        updateData.hrReviewStatus = 'HOLD';
        updateData.hrReviewDate = now;
        updateData.hrRemarks = input.note || null;
      } else if (input.action === 'accounts_approve') {
        updateData.status = 'PENDING_EXIT_CLEARANCE';
        updateData.accountsReviewStatus = 'APPROVED';
        updateData.accountsReviewDate = now;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'accounts_reject') {
        updateData.status = 'REJECTED';
        updateData.accountsReviewStatus = 'REJECTED';
        updateData.accountsReviewDate = now;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'accounts_request_correction') {
        updateData.status = 'DRAFT';
        updateData.accountsReviewStatus = 'CORRECTION_REQUESTED';
        updateData.accountsReviewDate = now;
        updateData.accountsRemarks = input.note || null;
      } else if (input.action === 'generate_acceptance_letter') {
        updateData.acceptanceLetterGeneratedAt = now;
      } else if (input.action === 'generate_experience_letter') {
        updateData.experienceLetterGeneratedAt = now;
      } else if (input.action === 'generate_relieving_letter') {
        updateData.relievingLetterGeneratedAt = now;
      } else if (input.action === 'archive_employee') {
        updateData.archivedAt = now;
      }

      const updated = await tx.employeeResignation.update({
        where: { id: resignation.id },
        data: updateData,
        include: resignationIncludes,
      });

      if (
        updated.status === 'PENDING_EXIT_CLEARANCE' &&
        ['hr_approve', 'accounts_approve'].includes(input.action)
      ) {
        await ensureExitClearanceForResignation(tx, updated, actor.userId);
      }

      if (input.action === 'archive_employee' && resignation.employee.user?.id) {
        await tx.user.update({
          where: { id: resignation.employee.user.id },
          data: { status: 'DISABLED' },
        }).catch(() => null);
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: resignation.branchId,
          module: 'hr',
          action: `resignation-${input.action}`,
          entityType: 'EmployeeResignation',
          entityId: resignation.id,
          before: { status: resignation.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });

    if (input.action === 'submit') {
      const managementUsers = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: { name: { in: ['Management', 'Admin', 'Super Admin'] } } } },
        },
        select: { id: true },
      });
      for (const user of managementUsers) {
        await publishNotification({
          recipientId: user.id,
          branchId: resignation.branchId,
          module: 'hr',
          title: `Resignation approval needed: ${resignation.employee.firstName} ${resignation.employee.lastName}`,
          body: resignationDetailText(result),
          href: '/hr/resignations',
        });
      }
    }

    if (input.action === 'manager_approve') {
      await publishToPermission('hr:write', {
        branchId: resignation.branchId,
        module: 'hr',
        title: `HR resignation review needed: ${resignation.employee.firstName} ${resignation.employee.lastName}`,
        body: resignationDetailText(result),
        href: '/hr/resignations',
      });
    }

    if (input.action === 'hr_approve' && resignation.settlementRequired) {
      await publishToPermission('accounts:post', {
        branchId: resignation.branchId,
        module: 'hr',
        title: `Settlement verification needed: ${resignation.employee.firstName} ${resignation.employee.lastName}`,
        body: resignationDetailText(result),
        href: '/hr/resignations',
      });
    }

    if ((input.action === 'hr_approve' && !resignation.settlementRequired) || input.action === 'accounts_approve') {
      await publishToPermission('hr:write', {
        branchId: resignation.branchId,
        module: 'hr',
        title: `Exit clearance draft created: ${resignation.employee.firstName} ${resignation.employee.lastName}`,
        body: resignationDetailText(result),
        href: '/hr/exit-clearance',
      });
    }

    return result;
  },

  async countByStatus(session: AppSession | null, branchId?: string) {
    const actor = assertCanReadResignationModule(session);
    await assertResignationTablesAvailable();
    const counts = await prisma.employeeResignation.groupBy({
      by: ['status'],
      where: getResignationWhere(actor, { branchId }),
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const row of counts) result[row.status] = row._count;
    return result;
  },
};

export const exitClearanceService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; q?: string } = {},
  ) {
    const actor = assertCanReadResignationModule(session);
    await assertResignationTablesAvailable();
    return prisma.employeeExitClearance.findMany({
      where: getExitClearanceWhere(actor, filters),
      include: exitClearanceIncludes,
      orderBy: [{ lastWorkingDate: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    const actor = assertCanReadResignationModule(session);
    await assertResignationTablesAvailable();
    const record = await prisma.employeeExitClearance.findFirst({
      where: { id, ...getExitClearanceWhere(actor) },
      include: exitClearanceIncludes,
    });
    if (!record) throw new NotFoundError('Exit clearance not found');
    return record;
  },

  async upsert(session: AppSession | null, input: ExitClearanceUpsertInput) {
    const actor = assertHrCanWrite(session);
    await assertResignationTablesAvailable();
    const existing = input.id
      ? await prisma.employeeExitClearance.findUnique({
          where: { id: input.id },
          include: exitClearanceIncludes,
        })
      : await prisma.employeeExitClearance.findUnique({
          where: { resignationId: input.resignationId },
          include: exitClearanceIncludes,
        });
    if (!existing) throw new NotFoundError('Exit clearance not found');
    if (existing.status === 'COMPLETED') throw new ValidationError('Completed exit clearances cannot be edited');

    const assetDamageRecovery = input.assets.reduce((sum, asset) => sum + (asset.deductionAmount || 0), 0);
    const netPayable = computeExitNetPayable({
      pendingSalary: input.settlement.pendingSalary,
      leaveEncashment: input.settlement.leaveEncashment,
      bonus: input.settlement.bonus,
      overtime: input.settlement.overtime,
      gratuity: input.settlement.gratuity,
      loanRecovery: input.settlement.loanRecovery,
      advanceRecovery: input.settlement.advanceRecovery,
      assetDamageRecovery,
      noticePay: input.settlement.noticePay,
      taxDeduction: input.settlement.taxDeduction,
      otherDeduction: input.settlement.otherDeduction,
    });

    return prisma.$transaction(async (tx) => {
      const updated = await tx.employeeExitClearance.update({
        where: { id: existing.id },
        data: {
          exitType: input.exitType,
          reasonForExit: input.reasonForExit || null,
          noticePeriodServed: input.noticePeriodServed,
          handoverCompleted: input.handoverCompleted,
          replacementAssigned: input.replacementAssigned,
          exitInterviewCompleted: input.exitInterviewCompleted,
          hrRemarks: input.hrRemarks || null,
          updatedById: actor.userId,
          departments: {
            upsert: mapDepartmentRows(existing.id, existing.departments, input.departments),
          },
          assets: {
            upsert: mapAssetRows(existing.id, existing.assets, input.assets),
          },
          systemAccess: {
            upsert: {
              create: input.systemAccess,
              update: input.systemAccess,
            },
          },
          settlement: {
            upsert: {
              create: {
                pendingSalary: D(input.settlement.pendingSalary),
                leaveEncashment: D(input.settlement.leaveEncashment),
                bonus: D(input.settlement.bonus),
                overtime: D(input.settlement.overtime),
                loanRecovery: D(input.settlement.loanRecovery),
                advanceRecovery: D(input.settlement.advanceRecovery),
                assetDamageRecovery: D(assetDamageRecovery),
                noticePay: D(input.settlement.noticePay),
                gratuity: D(input.settlement.gratuity),
                taxDeduction: D(input.settlement.taxDeduction),
                otherDeduction: D(input.settlement.otherDeduction),
                netPayable,
                remarks: input.settlement.remarks || null,
              },
              update: {
                pendingSalary: D(input.settlement.pendingSalary),
                leaveEncashment: D(input.settlement.leaveEncashment),
                bonus: D(input.settlement.bonus),
                overtime: D(input.settlement.overtime),
                loanRecovery: D(input.settlement.loanRecovery),
                advanceRecovery: D(input.settlement.advanceRecovery),
                assetDamageRecovery: D(assetDamageRecovery),
                noticePay: D(input.settlement.noticePay),
                gratuity: D(input.settlement.gratuity),
                taxDeduction: D(input.settlement.taxDeduction),
                otherDeduction: D(input.settlement.otherDeduction),
                netPayable,
                remarks: input.settlement.remarks || null,
              },
            },
          },
          interview: {
            upsert: {
              create: {
                reasonForLeaving: input.interview.reasonForLeaving || null,
                companyRating: input.interview.companyRating,
                managerRating: input.interview.managerRating,
                suggestions: input.interview.suggestions || null,
                rehireEligible: input.interview.rehireEligible,
                interviewConductedBy: input.interview.interviewConductedBy || null,
              },
              update: {
                reasonForLeaving: input.interview.reasonForLeaving || null,
                companyRating: input.interview.companyRating,
                managerRating: input.interview.managerRating,
                suggestions: input.interview.suggestions || null,
                rehireEligible: input.interview.rehireEligible,
                interviewConductedBy: input.interview.interviewConductedBy || null,
              },
            },
          },
        },
        include: exitClearanceIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: existing.branchId,
          module: 'hr',
          action: 'exit-clearance-save',
          entityType: 'EmployeeExitClearance',
          entityId: existing.id,
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  },

  async changeStatus(session: AppSession | null, input: ExitClearanceStatusActionInput) {
    await assertResignationTablesAvailable();
    const clearance = await prisma.employeeExitClearance.findUnique({
      where: { id: input.id },
      include: exitClearanceIncludes,
    });
    if (!clearance) throw new NotFoundError('Exit clearance not found');

    let actor: AppSession;
    switch (input.action) {
      case 'submit':
      case 'cancel':
      case 'hr_approve':
      case 'hr_hold':
      case 'hr_reject':
      case 'generate_relieving_letter':
      case 'generate_experience_letter':
      case 'generate_full_final_settlement':
      case 'generate_exit_clearance_certificate':
      case 'generate_no_due_certificate':
      case 'generate_service_certificate':
      case 'archive_employee':
        actor = assertHrCanWrite(session);
        break;
      case 'department_approve':
      case 'department_reject':
      case 'department_send_back':
        actor = assertDepartmentCanReview(session);
        break;
      case 'accounts_approve':
      case 'accounts_reject':
      case 'accounts_recalculate':
        actor = assertAccountsCanReview(session);
        break;
      default:
        throw new ValidationError('Unsupported exit clearance action');
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      let updated: ExitClearanceRecord;

      if (input.action === 'submit') {
        if (!['DRAFT', 'REJECTED', 'CANCELLED'].includes(clearance.status)) {
          throw new ValidationError('Only draft, rejected, or cancelled exit clearances can be submitted');
        }
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: { status: 'PENDING_DEPARTMENT_CLEARANCE', updatedById: actor.userId },
          include: exitClearanceIncludes,
        });
      } else if (input.action === 'cancel') {
        if (clearance.status === 'COMPLETED') throw new ValidationError('Completed exit clearances cannot be cancelled');
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: { status: 'CANCELLED', cancelledAt: now, updatedById: actor.userId },
          include: exitClearanceIncludes,
        });
      } else if (input.action.startsWith('department_')) {
        if (clearance.status !== 'PENDING_DEPARTMENT_CLEARANCE') {
          throw new ValidationError('Department review is only available while department clearance is pending');
        }
        const departmentKey = input.departmentKey || '';
        if (!DEPARTMENT_REVIEW_KEYS.has(departmentKey)) {
          throw new ValidationError('This department is not reviewed in the department clearance step');
        }
        const status =
          input.action === 'department_approve'
            ? 'APPROVED'
            : input.action === 'department_reject'
              ? 'REJECTED'
              : 'SENT_BACK';
        await tx.employeeExitDepartmentClearance.update({
          where: {
            clearanceId_departmentKey: {
              clearanceId: clearance.id,
              departmentKey,
            },
          },
          data: {
            status,
            remarks: input.note || null,
            approverId: actor.userId,
            approvedAt: now,
          },
        });
        const refreshed = await tx.employeeExitClearance.findUnique({
          where: { id: clearance.id },
          include: exitClearanceIncludes,
        });
        if (!refreshed) throw new NotFoundError('Exit clearance not found');
        if (input.action === 'department_send_back') {
          updated = await tx.employeeExitClearance.update({
            where: { id: clearance.id },
            data: { status: 'DRAFT', updatedById: actor.userId },
            include: exitClearanceIncludes,
          });
        } else if (input.action === 'department_reject') {
          updated = await tx.employeeExitClearance.update({
            where: { id: clearance.id },
            data: { status: 'REJECTED', updatedById: actor.userId },
            include: exitClearanceIncludes,
          });
        } else if (areAllDepartmentRowsCleared(refreshed.departments)) {
          updated = await tx.employeeExitClearance.update({
            where: { id: clearance.id },
            data: {
              status: 'PENDING_ACCOUNTS_APPROVAL',
              departmentClearedAt: now,
              updatedById: actor.userId,
            },
            include: exitClearanceIncludes,
          });
        } else {
          updated = refreshed;
        }
      } else if (input.action === 'accounts_recalculate') {
        const settlement = clearance.settlement;
        if (!settlement) throw new ValidationError('Accounts settlement is missing');
        const assetDamageRecovery = clearance.assets.reduce((sum, asset) => sum + Number(asset.deductionAmount), 0);
        const netPayable = computeExitNetPayable({
          pendingSalary: Number(settlement.pendingSalary),
          leaveEncashment: Number(settlement.leaveEncashment),
          bonus: Number(settlement.bonus),
          overtime: Number(settlement.overtime),
          gratuity: Number(settlement.gratuity),
          loanRecovery: Number(settlement.loanRecovery),
          advanceRecovery: Number(settlement.advanceRecovery),
          assetDamageRecovery,
          noticePay: Number(settlement.noticePay),
          taxDeduction: Number(settlement.taxDeduction),
          otherDeduction: Number(settlement.otherDeduction),
        });
        await tx.employeeExitAccountsSettlement.update({
          where: { clearanceId: clearance.id },
          data: {
            assetDamageRecovery: D(assetDamageRecovery),
            netPayable,
            remarks: input.note || settlement.remarks,
          },
        });
        updated = (await tx.employeeExitClearance.findUnique({
          where: { id: clearance.id },
          include: exitClearanceIncludes,
        })) as ExitClearanceRecord;
      } else if (input.action === 'accounts_approve') {
        if (clearance.status !== 'PENDING_ACCOUNTS_APPROVAL') {
          throw new ValidationError('Accounts approval is not available for this exit clearance');
        }
        await tx.employeeExitAccountsSettlement.update({
          where: { clearanceId: clearance.id },
          data: {
            status: 'APPROVED',
            approvedById: actor.userId,
            approvedAt: now,
            remarks: input.note || clearance.settlement?.remarks || null,
          },
        });
        await tx.employeeExitDepartmentClearance.updateMany({
          where: { clearanceId: clearance.id, departmentKey: 'ACCOUNTS' },
          data: { status: 'APPROVED', approverId: actor.userId, approvedAt: now, remarks: input.note || null },
        });
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: {
            status: 'PENDING_HR_APPROVAL',
            accountsApprovedAt: now,
            updatedById: actor.userId,
          },
          include: exitClearanceIncludes,
        });
      } else if (input.action === 'accounts_reject') {
        await tx.employeeExitAccountsSettlement.update({
          where: { clearanceId: clearance.id },
          data: {
            status: 'REJECTED',
            approvedById: actor.userId,
            approvedAt: now,
            remarks: input.note || clearance.settlement?.remarks || null,
          },
        });
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: { status: 'REJECTED', updatedById: actor.userId },
          include: exitClearanceIncludes,
        });
      } else if (input.action === 'hr_hold') {
        if (clearance.status !== 'PENDING_HR_APPROVAL') {
          throw new ValidationError('HR hold is only available while HR approval is pending');
        }
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: { updatedById: actor.userId, hrRemarks: input.note || clearance.hrRemarks },
          include: exitClearanceIncludes,
        });
      } else if (input.action === 'hr_reject') {
        if (clearance.status !== 'PENDING_HR_APPROVAL') {
          throw new ValidationError('HR rejection is only available while HR approval is pending');
        }
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: { status: 'REJECTED', updatedById: actor.userId, hrRemarks: input.note || clearance.hrRemarks },
          include: exitClearanceIncludes,
        });
      } else if (input.action === 'hr_approve') {
        if (clearance.status !== 'PENDING_HR_APPROVAL') {
          throw new ValidationError('HR approval is only available while HR approval is pending');
        }
        if (!clearance.settlement || clearance.settlement.status !== 'APPROVED') {
          throw new ValidationError('Accounts settlement must be approved before final HR approval');
        }
        if (!areAllDepartmentRowsCleared(clearance.departments)) {
          throw new ValidationError('All department clearances must be approved before final HR approval');
        }
        if (!areAllSystemAccessItemsDone(clearance.systemAccess)) {
          throw new ValidationError('All system access items must be completed before final HR approval');
        }

        await tx.employeeExitDepartmentClearance.updateMany({
          where: { clearanceId: clearance.id, departmentKey: 'HR' },
          data: { status: 'APPROVED', approverId: actor.userId, approvedAt: now, remarks: input.note || null },
        });
        updated = await tx.employeeExitClearance.update({
          where: { id: clearance.id },
          data: {
            status: 'COMPLETED',
            hrApprovedAt: now,
            completedAt: now,
            updatedById: actor.userId,
            hrRemarks: input.note || clearance.hrRemarks,
          },
          include: exitClearanceIncludes,
        });
        await tx.employeeResignation.update({
          where: { id: clearance.resignationId },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            updatedById: actor.userId,
          },
        });
        await tx.employee.update({
          where: { id: clearance.employeeId },
          data: {
            status: 'RESIGNED',
            leftAt: clearance.lastWorkingDate,
            updatedById: actor.userId,
          },
        });
        if (clearance.employee.user?.id) {
          await tx.user.update({
            where: { id: clearance.employee.user.id },
            data: { status: 'DISABLED' },
          }).catch(() => null);
        }
      } else {
        const timestampField =
          input.action === 'generate_relieving_letter'
            ? { relievingLetterGeneratedAt: now }
            : input.action === 'generate_experience_letter'
              ? { experienceLetterGeneratedAt: now }
              : input.action === 'generate_full_final_settlement'
                ? { fullAndFinalGeneratedAt: now }
                : input.action === 'generate_exit_clearance_certificate'
                  ? { clearanceCertificateGeneratedAt: now }
                  : input.action === 'generate_no_due_certificate'
                    ? { noDueCertificateGeneratedAt: now }
                    : input.action === 'generate_service_certificate'
                      ? { serviceCertificateGeneratedAt: now }
                      : null;
        if (timestampField) {
          updated = await tx.employeeExitClearance.update({
            where: { id: clearance.id },
            data: { ...timestampField, updatedById: actor.userId },
            include: exitClearanceIncludes,
          });
        } else if (input.action === 'archive_employee') {
          await tx.employee.update({
            where: { id: clearance.employeeId },
            data: {
              status: 'RESIGNED',
              leftAt: clearance.lastWorkingDate,
              updatedById: actor.userId,
            },
          });
          updated = await tx.employeeExitClearance.update({
            where: { id: clearance.id },
            data: { updatedById: actor.userId },
            include: exitClearanceIncludes,
          });
        } else {
          throw new ValidationError('Unsupported exit clearance action');
        }
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: clearance.branchId,
          module: 'hr',
          action: `exit-clearance-${input.action}`,
          entityType: 'EmployeeExitClearance',
          entityId: clearance.id,
          before: { status: clearance.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  },
};

export const resignationSupportService = {
  getLatestConfirmationDate,
};
