'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { attendanceSummaryGenerateSchema, attendanceSummaryActionSchema } from '@/server/validators/attendance-summary';

export type AttSummFormState = { error?: string; success?: boolean; generatedCount?: number } | undefined;

const PATH = '/hr/attendance-summary';

export async function generateAttendanceSummaryAction(_prev: AttSummFormState, fd: FormData): Promise<AttSummFormState> {
  const parsed = attendanceSummaryGenerateSchema.safeParse({
    summaryMonth: fd.get('summaryMonth'),
    branchId: fd.get('branchId'),
    department: fd.get('department') ?? '',
    shiftId: fd.get('shiftId') ?? '',
    employeeId: fd.get('employeeId') ?? '',
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  let url = `${PATH}?summaryMonth=${parsed.data.summaryMonth}&branchId=${parsed.data.branchId}`;
  if (parsed.data.department) url += `&department=${parsed.data.department}`;
  if (parsed.data.shiftId) url += `&shiftId=${parsed.data.shiftId}`;
  if (parsed.data.employeeId) url += `&employeeId=${parsed.data.employeeId}`;

  try {
    await backendFetch('/api/mobile/hr/attendance-summary', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }

  redirect(url);
}

export async function singleSummaryAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '');
  if (!id || !action) return;

  const parsed = attendanceSummaryActionSchema.safeParse({ id, action });
  if (!parsed.success) return;

  try {
    await backendFetch(`/api/mobile/hr/attendance-summary/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: parsed.data.action }),
    });
    revalidatePath(PATH);
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }
}

export async function recalculateSummaryAction(fd: FormData) {
  const summaryMonth = String(fd.get('summaryMonth') ?? '');
  const branchId = String(fd.get('branchId') ?? '');
  const employeeId = String(fd.get('employeeId') ?? '');

  if (!summaryMonth || !branchId || !employeeId) return;

  try {
    await backendFetch('/api/mobile/hr/attendance-summary', {
      method: 'POST',
      body: JSON.stringify({ summaryMonth, branchId, employeeId }),
    });
    revalidatePath(PATH);
  } catch {
    // Silent, matching the original Server Action's fire-and-forget behavior.
  }
}
