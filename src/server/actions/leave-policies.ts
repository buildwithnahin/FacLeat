'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { ApiError } from '@/lib/errors';
import { leavePoliciesService } from '@/server/services/leave-policies.service';
import {
  leavePolicyCreateSchema,
  leavePolicyUpdateSchema,
  type LeavePolicyRuleInput,
} from '@/server/validators/leave-policies';

export type LeavePolicyFormState =
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

function parseRules(fd: FormData): LeavePolicyRuleInput[] {
  const raw = String(fd.get('rules') ?? '[]');
  try {
    return JSON.parse(raw) as LeavePolicyRuleInput[];
  } catch {
    return [];
  }
}

function parseAssignedEmployeeIds(fd: FormData): string[] {
  const raw = String(fd.get('assignedEmployeeIds') ?? '[]');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

function parseForm(fd: FormData) {
  return {
    policyCode: String(fd.get('policyCode') ?? ''),
    policyName: String(fd.get('policyName') ?? ''),
    branchId: String(fd.get('branchId') ?? ''),
    department: String(fd.get('department') ?? ''),
    designation: String(fd.get('designation') ?? ''),
    employmentType: String(fd.get('employmentType') ?? ''),
    employeeCategory: String(fd.get('employeeCategory') ?? ''),
    gender: String(fd.get('gender') ?? ''),
    grade: String(fd.get('grade') ?? ''),
    effectiveFrom: String(fd.get('effectiveFrom') ?? ''),
    effectiveTo: fd.get('effectiveTo') ? String(fd.get('effectiveTo')) : null,
    status: String(fd.get('status') ?? 'DRAFT'),
    description: String(fd.get('description') ?? ''),
    approvalRequired: parseBoolean(fd, 'approvalRequired'),
    managerApprovalRequired: parseBoolean(fd, 'managerApprovalRequired'),
    hrApprovalRequired: parseBoolean(fd, 'hrApprovalRequired'),
    accountsApprovalRequired: parseBoolean(fd, 'accountsApprovalRequired'),
    autoApproveAllowed: parseBoolean(fd, 'autoApproveAllowed'),
    hrCanOverrideBalance: parseBoolean(fd, 'hrCanOverrideBalance'),
    allowProbationEmployees: parseBoolean(fd, 'allowProbationEmployees'),
    carryForwardAllowed: parseBoolean(fd, 'carryForwardAllowed'),
    maxCarryForwardDays: parseOptionalNumber(fd.get('maxCarryForwardDays')),
    carryForwardExpiryMonth: parseOptionalNumber(fd.get('carryForwardExpiryMonth')),
    carryForwardExpiryDay: parseOptionalNumber(fd.get('carryForwardExpiryDay')),
    encashmentAllowed: parseBoolean(fd, 'encashmentAllowed'),
    maxEncashmentDays: parseOptionalNumber(fd.get('maxEncashmentDays')),
    autoClosing: parseBoolean(fd, 'autoClosing'),
    payrollImpactDefault: String(fd.get('payrollImpactDefault') ?? 'NO_PAYROLL_IMPACT'),
    assignedEmployeeIds: parseAssignedEmployeeIds(fd),
    rules: parseRules(fd),
  };
}

export async function createLeavePolicyAction(
  _prev: LeavePolicyFormState,
  fd: FormData,
): Promise<LeavePolicyFormState> {
  const parsed = leavePolicyCreateSchema.safeParse(parseForm(fd));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const policy = await leavePoliciesService.create(session, parsed.data);
    revalidatePath('/hr/leave-policy');
    revalidatePath('/hr/leaves');
    revalidatePath('/hr/leave-balance');
    return { success: true, id: policy.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function updateLeavePolicyAction(
  _prev: LeavePolicyFormState,
  fd: FormData,
): Promise<LeavePolicyFormState> {
  const parsed = leavePolicyUpdateSchema.safeParse({
    id: String(fd.get('id') ?? ''),
    ...parseForm(fd),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const policy = await leavePoliciesService.update(session, parsed.data);
    revalidatePath('/hr/leave-policy');
    revalidatePath('/hr/leaves');
    revalidatePath('/hr/leave-balance');
    return { success: true, id: policy.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function generateLeavePolicyAssignmentsAction(fd: FormData) {
  const policyId = String(fd.get('policyId') ?? '');
  if (!policyId) return;

  try {
    const session = await getSession();
    await leavePoliciesService.generateAssignments(session, policyId);
    revalidatePath('/hr/leave-policy');
    revalidatePath('/hr/leave-balance');
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
