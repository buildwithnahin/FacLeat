'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { leaveApplicationSchema, leaveApprovalSchema } from '@/server/validators/leaves';

export type LeaveFormState = { error?: string; success?: boolean } | undefined;

const PATH = '/hr/leaves';

export async function applyLeaveAction(_prev: LeaveFormState, fd: FormData): Promise<LeaveFormState> {
  const employeeId = String(fd.get('employeeId') ?? '');
  const type = String(fd.get('type') ?? '');
  const fromDate = String(fd.get('fromDate') ?? '');
  const toDate = String(fd.get('toDate') ?? '');
  const halfDay = fd.get('halfDay') === 'true';
  const halfDayType = fd.get('halfDayType') ? String(fd.get('halfDayType')) : null;
  const reason = String(fd.get('reason') ?? '');
  const attachmentPath = fd.get('attachmentPath') ? String(fd.get('attachmentPath')) : null;
  const emergencyContact = fd.get('emergencyContact') ? String(fd.get('emergencyContact')) : null;
  const handoverEmployeeId = fd.get('handoverEmployeeId') ? String(fd.get('handoverEmployeeId')) : null;

  const parsed = leaveApplicationSchema.safeParse({
    employeeId,
    type,
    fromDate,
    toDate,
    halfDay,
    halfDayType,
    reason,
    attachmentPath,
    emergencyContact,
    handoverEmployeeId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  try {
    await backendFetch('/api/mobile/hr/leaves', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function decideLeaveAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const stage = String(fd.get('stage') ?? '');
  const action = String(fd.get('action') ?? '');
  const remarks = fd.get('remarks') ? String(fd.get('remarks')) : null;

  const parsed = leaveApprovalSchema.safeParse({ id, stage, action, remarks });
  if (!parsed.success) return;

  try {
    await backendFetch(`/api/mobile/hr/leaves/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ stage: parsed.data.stage, action: parsed.data.action, remarks: parsed.data.remarks }),
    });
    revalidatePath(PATH);
    revalidatePath('/hr/leave-approval');
  } catch {
    // silently ignore, mirrors root behavior
  }
}

export async function bulkDecideLeaveAction(fd: FormData) {
  const idsStr = String(fd.get('ids') ?? '[]');
  const stage = String(fd.get('stage') ?? '');
  const action = String(fd.get('action') ?? '');
  const remarks = fd.get('remarks') ? String(fd.get('remarks')) : null;

  try {
    const ids = JSON.parse(idsStr) as string[];
    await backendFetch('/api/mobile/hr/leaves/bulk-decide', {
      method: 'POST',
      body: JSON.stringify({ ids, stage, action, remarks }),
    });
    revalidatePath(PATH);
    revalidatePath('/hr/leave-approval');
  } catch {
    // silently ignore, mirrors root behavior
  }
}

export async function withdrawLeaveAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) return;

  try {
    await backendFetch(`/api/mobile/hr/leaves/${id}/withdraw`, { method: 'POST' });
    revalidatePath(PATH);
  } catch {
    // silently ignore, mirrors root behavior
  }
}

export async function getLeaveBalanceAction(employeeId: string, year: number) {
  try {
    return await backendFetch(`/api/mobile/hr/leaves/balance?employeeId=${encodeURIComponent(employeeId)}&year=${year}`);
  } catch {
    return null;
  }
}

type LeavePolicyPreview = {
  policy: { policyName: string; rules: Array<{ leaveType: string }> };
  balance: Record<
    string,
    {
      entitled: number;
      used: number;
      pending: number;
      carryForward: number;
      encashed: number;
      available: number;
      isUnlimited: boolean;
      status: string;
    }
  >;
};

export async function getLeavePolicyPreviewAction(employeeId: string, year: number) {
  try {
    return await backendFetch<LeavePolicyPreview>(
      `/api/mobile/hr/leaves/policy-preview?employeeId=${encodeURIComponent(employeeId)}&year=${year}`,
    );
  } catch {
    return null;
  }
}
