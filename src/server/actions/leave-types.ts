'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { ApiError } from '@/lib/errors';
import { leaveTypesService } from '@/server/services/leave-types.service';
import {
  leaveTypeCreateSchema,
  leaveTypeUpdateSchema,
  type LeaveTypeCreateInput,
} from '@/server/validators/leave-types';

export type LeaveTypeFormState =
  | { success?: boolean; error?: string; fieldErrors?: Record<string, string[]>; id?: string }
  | undefined;

function parseBoolean(fd: FormData, key: string) {
  return fd.get(key) === 'true';
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseStringArray(fd: FormData, key: string) {
  const raw = String(fd.get(key) ?? '[]');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function parseForm(fd: FormData): LeaveTypeCreateInput {
  return {
    code: String(fd.get('code') ?? ''),
    name: String(fd.get('name') ?? ''),
    description: String(fd.get('description') ?? ''),
    status: String(fd.get('status') ?? 'ACTIVE') as LeaveTypeCreateInput['status'],
    paidLeave: parseBoolean(fd, 'paidLeave'),
    annualEntitlement: parseOptionalNumber(fd.get('annualEntitlement')),
    maxConsecutiveDays: parseOptionalNumber(fd.get('maxConsecutiveDays')),
    minimumLeaveDays: parseOptionalNumber(fd.get('minimumLeaveDays')),
    applyBeforeDays: parseOptionalNumber(fd.get('applyBeforeDays')),
    unit: String(fd.get('unit') ?? 'FULL_DAY') as LeaveTypeCreateInput['unit'],
    applicableEmploymentTypes: parseStringArray(fd, 'applicableEmploymentTypes'),
    genderApplicability: String(fd.get('genderApplicability') ?? 'ALL') as LeaveTypeCreateInput['genderApplicability'],
    applicableDepartment: String(fd.get('applicableDepartment') ?? ''),
    applicableDesignation: String(fd.get('applicableDesignation') ?? ''),
    applicableBranchId: String(fd.get('applicableBranchId') ?? ''),
    attachmentRequired: parseBoolean(fd, 'attachmentRequired'),
    medicalCertificateRequired: parseBoolean(fd, 'medicalCertificateRequired'),
    allowHalfDay: parseBoolean(fd, 'allowHalfDay'),
    allowBackdatedApplication: parseBoolean(fd, 'allowBackdatedApplication'),
    allowFutureApplication: parseBoolean(fd, 'allowFutureApplication'),
    approvalRequired: parseBoolean(fd, 'approvalRequired'),
    autoApprove: parseBoolean(fd, 'autoApprove'),
    holidayIncluded: parseBoolean(fd, 'holidayIncluded'),
    weekendIncluded: parseBoolean(fd, 'weekendIncluded'),
    carryForwardAllowed: parseBoolean(fd, 'carryForwardAllowed'),
    maximumCarryForwardDays: parseOptionalNumber(fd.get('maximumCarryForwardDays')),
    carryForwardExpiryMonths: parseOptionalNumber(fd.get('carryForwardExpiryMonths')),
    requiredAttachmentTypes: parseStringArray(fd, 'requiredAttachmentTypes') as LeaveTypeCreateInput['requiredAttachmentTypes'],
    allowNegativeBalance: parseBoolean(fd, 'allowNegativeBalance'),
    displayOrder: Number(fd.get('displayOrder') ?? 0),
  };
}

export async function createLeaveTypeAction(
  _prev: LeaveTypeFormState,
  fd: FormData,
): Promise<LeaveTypeFormState> {
  const parsed = leaveTypeCreateSchema.safeParse(parseForm(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const row = await leaveTypesService.create(session, parsed.data);
    revalidatePath('/hr/leave-types');
    revalidatePath('/hr/leave-policy');
    revalidatePath('/hr/leaves');
    revalidatePath('/hr/leave-balance');
    revalidatePath('/hr/leave-approval');
    return { success: true, id: row.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function updateLeaveTypeAction(
  _prev: LeaveTypeFormState,
  fd: FormData,
): Promise<LeaveTypeFormState> {
  const parsed = leaveTypeUpdateSchema.safeParse({
    id: String(fd.get('id') ?? ''),
    ...parseForm(fd),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const row = await leaveTypesService.update(session, parsed.data);
    revalidatePath('/hr/leave-types');
    revalidatePath('/hr/leave-policy');
    revalidatePath('/hr/leaves');
    revalidatePath('/hr/leave-balance');
    revalidatePath('/hr/leave-approval');
    return { success: true, id: row.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
