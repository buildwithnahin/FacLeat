'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { shiftCreateSchema, shiftUpdateSchema } from '@/server/validators/shifts';

export type ShiftFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function parseShiftForm(formData: FormData) {
  return {
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    code: formData.get('code'),
    status: formData.get('status') ?? 'ACTIVE',
    description: formData.get('description') ?? '',
    shiftType: formData.get('shiftType') ?? 'DAY',
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    breakStart: formData.get('breakStart') ?? '',
    breakEnd: formData.get('breakEnd') ?? '',
    lateGraceMinutes: formData.get('lateGraceMinutes') ?? 15,
    earlyExitGraceMinutes: formData.get('earlyExitGraceMinutes') ?? 10,
    minPresentMinutes: formData.get('minPresentMinutes'),
    minHalfDayMinutes: formData.get('minHalfDayMinutes'),
    absentBelowMinutes: formData.get('absentBelowMinutes'),
    overtimeAllowed: formData.get('overtimeAllowed') === 'on',
    otStartsAfter: formData.get('otStartsAfter') ?? '',
    minOtMinutes: formData.get('minOtMinutes') ?? 30,
    maxOtMinutesPerDay: formData.get('maxOtMinutesPerDay') ?? 240,
    weeklyOffDays: formData.getAll('weeklyOffDays'),
  };
}

export async function createShiftAction(_prev: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  const parsed = shiftCreateSchema.safeParse(parseShiftForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/hr/shifts', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/shifts');
  redirect('/hr/shifts');
}

export async function updateShiftAction(_prev: ShiftFormState, formData: FormData): Promise<ShiftFormState> {
  const parsed = shiftUpdateSchema.safeParse({ id: formData.get('id'), ...parseShiftForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/hr/shifts/${parsed.data.id}`, { method: 'PUT', body: JSON.stringify(parsed.data) });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/shifts');
  redirect('/hr/shifts');
}
