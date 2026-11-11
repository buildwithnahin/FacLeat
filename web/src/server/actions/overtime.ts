'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { overtimeGenerateSchema } from '@/server/validators/overtime';

export type OtFormState = { error?: string; success?: boolean; generatedCount?: number } | undefined;

const OT_PATH = '/hr/overtime';

export async function generateOvertimeAction(_prev: OtFormState, fd: FormData): Promise<OtFormState> {
  const parsed = overtimeGenerateSchema.safeParse({
    date: fd.get('date'),
    branchId: fd.get('branchId'),
    department: fd.get('department') ?? '',
    shiftId: fd.get('shiftId') ?? '',
    employeeId: fd.get('employeeId') ?? '',
    otType: fd.get('otType') ?? 'REGULAR',
    otRateType: fd.get('otRateType') ?? 'FIXED_RATE',
    otRatePerHour: fd.get('otRatePerHour') ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    const result = await backendFetch<{ generatedCount: number }>('/api/mobile/hr/overtime', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(OT_PATH);
    return { success: true, generatedCount: result.generatedCount };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function overtimeStatusAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '');
  if (!id || !action) return;

  const body: Record<string, unknown> = { action };
  for (const key of ['approvedOtMinutes', 'verifiedMinutes', 'otRate', 'payrollMonth', 'costCenter', 'remarks']) {
    const value = fd.get(key);
    if (value !== null) body[key] = value;
  }

  try {
    await backendFetch(`/api/mobile/hr/overtime/${id}/status`, { method: 'POST', body: JSON.stringify(body) });
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }
  revalidatePath(OT_PATH);
}
