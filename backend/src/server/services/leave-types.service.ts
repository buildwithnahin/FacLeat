import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { LeaveTypeCreateInput, LeaveTypeUpdateInput } from '@/server/validators/leave-types';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
type LeaveTypeRecord = Prisma.LeaveTypeGetPayload<{}>;
const LEGACY_LEAVE_TYPES = [
  { code: 'CASUAL', name: 'Casual Leave', paidLeave: true, annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 10 },
  { code: 'SICK', name: 'Sick Leave', paidLeave: true, annualEntitlement: 14, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: true, displayOrder: 20 },
  { code: 'EARNED', name: 'Earned Leave', paidLeave: true, annualEntitlement: 15, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: true, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 30 },
  { code: 'ANNUAL', name: 'Annual Leave', paidLeave: true, annualEntitlement: 20, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: true, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 40 },
  { code: 'MATERNITY', name: 'Maternity Leave', paidLeave: true, annualEntitlement: 112, allowHalfDay: false, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 50 },
  { code: 'PATERNITY', name: 'Paternity Leave', paidLeave: true, annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 60 },
  { code: 'EMERGENCY', name: 'Emergency Leave', paidLeave: true, annualEntitlement: 5, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 70 },
  { code: 'UNPAID', name: 'Unpaid Leave', paidLeave: false, annualEntitlement: 100, allowHalfDay: true, allowNegativeBalance: true, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 80 },
  { code: 'COMPENSATORY', name: 'Compensatory Leave', paidLeave: true, annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 90 },
  { code: 'SPECIAL', name: 'Special Leave', paidLeave: true, annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 100 },
  { code: 'FESTIVAL', name: 'Festival Leave', paidLeave: true, annualEntitlement: 2, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 110 },
  { code: 'OTHER', name: 'Other Leave', paidLeave: true, annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false, weekendIncluded: false, holidayIncluded: false, carryForwardAllowed: false, maximumCarryForwardDays: null, maxConsecutiveDays: null, attachmentRequired: false, medicalCertificateRequired: false, displayOrder: 120 },
] as const;

function toNullableNumber(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : Number(value);
}

function toStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function serializeLeaveType(record: LeaveTypeRecord) {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    paidLeave: record.paidLeave,
    annualEntitlement: toNullableNumber(record.annualEntitlement),
    maxConsecutiveDays: toNullableNumber(record.maxConsecutiveDays),
    minimumLeaveDays: toNullableNumber(record.minimumLeaveDays),
    applyBeforeDays: record.applyBeforeDays,
    unit: record.unit,
    applicableEmploymentTypes: toStringArray(record.applicableEmploymentTypes),
    genderApplicability: record.genderApplicability,
    applicableDepartment: record.applicableDepartment,
    applicableDesignation: record.applicableDesignation,
    applicableBranchId: record.applicableBranchId,
    attachmentRequired: record.attachmentRequired,
    medicalCertificateRequired: record.medicalCertificateRequired,
    allowHalfDay: record.allowHalfDay,
    allowBackdatedApplication: record.allowBackdatedApplication,
    allowFutureApplication: record.allowFutureApplication,
    approvalRequired: record.approvalRequired,
    autoApprove: record.autoApprove,
    holidayIncluded: record.holidayIncluded,
    weekendIncluded: record.weekendIncluded,
    carryForwardAllowed: record.carryForwardAllowed,
    maximumCarryForwardDays: toNullableNumber(record.maximumCarryForwardDays),
    carryForwardExpiryMonths: record.carryForwardExpiryMonths,
    requiredAttachmentTypes: toStringArray(record.requiredAttachmentTypes),
    allowNegativeBalance: record.allowNegativeBalance,
    displayOrder: record.displayOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildLegacyLeaveType(code: typeof LEGACY_LEAVE_TYPES[number]['code']) {
  const row = LEGACY_LEAVE_TYPES.find((item) => item.code === code)!;
  return {
    id: `legacy-${row.code.toLowerCase()}`,
    code: row.code,
    name: row.name,
    description: 'Legacy fallback leave type. Apply the LeaveType migration to manage this from the database.',
    status: 'ACTIVE',
    paidLeave: row.paidLeave,
    annualEntitlement: row.annualEntitlement,
    maxConsecutiveDays: row.maxConsecutiveDays,
    minimumLeaveDays: null,
    applyBeforeDays: null,
    unit: 'FULL_DAY',
    applicableEmploymentTypes: [] as string[],
    genderApplicability: 'ALL',
    applicableDepartment: null,
    applicableDesignation: null,
    applicableBranchId: null,
    attachmentRequired: row.attachmentRequired,
    medicalCertificateRequired: row.medicalCertificateRequired,
    allowHalfDay: row.allowHalfDay,
    allowBackdatedApplication: false,
    allowFutureApplication: true,
    approvalRequired: true,
    autoApprove: false,
    holidayIncluded: row.holidayIncluded,
    weekendIncluded: row.weekendIncluded,
    carryForwardAllowed: row.carryForwardAllowed,
    maximumCarryForwardDays: row.maximumCarryForwardDays,
    carryForwardExpiryMonths: null,
    requiredAttachmentTypes: [] as string[],
    allowNegativeBalance: row.allowNegativeBalance,
    displayOrder: row.displayOrder,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function listLegacyLeaveTypes() {
  return LEGACY_LEAVE_TYPES.map((item) => buildLegacyLeaveType(item.code));
}

function isMissingLeaveTypeTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

function missingTableError() {
  return new ValidationError('LeaveType table is missing in the database. Run the latest Prisma migration first.');
}

function buildWriteData(input: LeaveTypeCreateInput | LeaveTypeUpdateInput, actorUserId: string) {
  return {
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description || null,
    status: input.status,
    paidLeave: input.paidLeave,
    annualEntitlement: input.annualEntitlement != null ? D(input.annualEntitlement) : null,
    maxConsecutiveDays: input.maxConsecutiveDays != null ? D(input.maxConsecutiveDays) : null,
    minimumLeaveDays: input.minimumLeaveDays != null ? D(input.minimumLeaveDays) : null,
    applyBeforeDays: input.applyBeforeDays != null ? Math.trunc(input.applyBeforeDays) : null,
    unit: input.unit,
    applicableEmploymentTypes: input.applicableEmploymentTypes,
    genderApplicability: input.genderApplicability,
    applicableDepartment: input.applicableDepartment || null,
    applicableDesignation: input.applicableDesignation || null,
    applicableBranchId: input.applicableBranchId || null,
    attachmentRequired: input.attachmentRequired,
    medicalCertificateRequired: input.medicalCertificateRequired,
    allowHalfDay: input.allowHalfDay,
    allowBackdatedApplication: input.allowBackdatedApplication,
    allowFutureApplication: input.allowFutureApplication,
    approvalRequired: input.approvalRequired,
    autoApprove: input.autoApprove,
    holidayIncluded: input.holidayIncluded,
    weekendIncluded: input.weekendIncluded,
    carryForwardAllowed: input.carryForwardAllowed,
    maximumCarryForwardDays: input.maximumCarryForwardDays != null ? D(input.maximumCarryForwardDays) : null,
    carryForwardExpiryMonths: input.carryForwardExpiryMonths != null ? Math.trunc(input.carryForwardExpiryMonths) : null,
    requiredAttachmentTypes: input.requiredAttachmentTypes,
    allowNegativeBalance: input.allowNegativeBalance,
    displayOrder: input.displayOrder,
    updatedById: actorUserId,
  };
}

export const leaveTypesService = {
  async list(session: AppSession | null, search = '') {
    await authorize(session, 'hr:read');
    const q = search.trim();
    try {
      const rows = await prisma.leaveType.findMany({
        where: q
          ? {
              OR: [
                { code: { contains: q } },
                { name: { contains: q } },
              ],
            }
          : undefined,
        orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      });
      return rows.map(serializeLeaveType);
    } catch (error) {
      if (!isMissingLeaveTypeTable(error)) throw error;
      return listLegacyLeaveTypes().filter((item) => !q || item.code.includes(q.toUpperCase()) || item.name.toLowerCase().includes(q.toLowerCase()));
    }
  },

  async listActive(session: AppSession | null) {
    await authorize(session, 'hr:read');
    try {
      const rows = await prisma.leaveType.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      });
      return rows.map(serializeLeaveType);
    } catch (error) {
      if (!isMissingLeaveTypeTable(error)) throw error;
      return listLegacyLeaveTypes();
    }
  },

  async listActivePublic() {
    try {
      const rows = await prisma.leaveType.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      });
      return rows.map(serializeLeaveType);
    } catch (error) {
      if (!isMissingLeaveTypeTable(error)) throw error;
      return listLegacyLeaveTypes();
    }
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    try {
      const row = await prisma.leaveType.findUnique({ where: { id } });
      if (!row) throw new NotFoundError('Leave type not found');
      return serializeLeaveType(row);
    } catch (error) {
      if (!isMissingLeaveTypeTable(error)) throw error;
      const fallback = listLegacyLeaveTypes().find((item) => item.id === id);
      if (!fallback) throw new NotFoundError('Leave type not found');
      return fallback;
    }
  },

  async getByCode(code: string) {
    try {
      return await prisma.leaveType.findUnique({
        where: { code: code.toUpperCase() },
      });
    } catch (error) {
      if (!isMissingLeaveTypeTable(error)) throw error;
      return listLegacyLeaveTypes().find((item) => item.code === code.toUpperCase()) ?? null;
    }
  },

  async assertCodeExists(code: string) {
    const row = await this.getByCode(code);
    if (!row) throw new ValidationError(`Leave type ${code} does not exist.`);
    return row;
  },

  async create(session: AppSession | null, input: LeaveTypeCreateInput) {
    const actor = await authorize(session, 'hr:write');
    let existing;
    try {
      existing = await prisma.leaveType.findUnique({
        where: { code: input.code.toUpperCase() },
        select: { id: true },
      });
    } catch (error) {
      if (isMissingLeaveTypeTable(error)) throw missingTableError();
      throw error;
    }
    if (existing) throw new ValidationError('A leave type with this code already exists.');

    return prisma.$transaction(async (tx) => {
      const row = await tx.leaveType.create({
        data: {
          ...buildWriteData(input, actor.userId),
          createdById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: row.applicableBranchId,
          module: 'hr',
          action: 'create-leave-type',
          entityType: 'LeaveType',
          entityId: row.id,
          after: { code: row.code, name: row.name, status: row.status },
        },
        tx,
      );

      return serializeLeaveType(row);
    });
  },

  async update(session: AppSession | null, input: LeaveTypeUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    let existing;
    try {
      existing = await prisma.leaveType.findUnique({ where: { id: input.id } });
    } catch (error) {
      if (isMissingLeaveTypeTable(error)) throw missingTableError();
      throw error;
    }
    if (!existing) throw new NotFoundError('Leave type not found');

    let duplicate;
    try {
      duplicate = await prisma.leaveType.findFirst({
        where: {
          code: input.code.toUpperCase(),
          id: { not: input.id },
        },
        select: { id: true },
      });
    } catch (error) {
      if (isMissingLeaveTypeTable(error)) throw missingTableError();
      throw error;
    }
    if (duplicate) throw new ValidationError('Another leave type already uses this code.');

    return prisma.$transaction(async (tx) => {
      const row = await tx.leaveType.update({
        where: { id: input.id },
        data: buildWriteData(input, actor.userId),
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: row.applicableBranchId,
          module: 'hr',
          action: 'update-leave-type',
          entityType: 'LeaveType',
          entityId: row.id,
          before: { code: existing.code, name: existing.name, status: existing.status },
          after: { code: row.code, name: row.name, status: row.status },
        },
        tx,
      );

      return serializeLeaveType(row);
    });
  },
};
