'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { holidayCreateSchema, holidayUpdateSchema } from '@/server/validators/holidays';

export type HolidayFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function parseHolidayForm(formData: FormData) {
  return {
    name: formData.get('name'),
    code: formData.get('code') ?? '',
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    type: formData.get('type'),
    branchId: formData.get('branchId') ?? '',
    isPaid: formData.get('isPaid') === 'on',
    status: formData.get('status') ?? 'ACTIVE',
    description: formData.get('description') ?? '',
  };
}

export async function createHolidayAction(_prev: HolidayFormState, formData: FormData): Promise<HolidayFormState> {
  const parsed = holidayCreateSchema.safeParse(parseHolidayForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/hr/holidays', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/holidays');
  redirect('/hr/holidays');
}

export async function updateHolidayAction(_prev: HolidayFormState, formData: FormData): Promise<HolidayFormState> {
  const parsed = holidayUpdateSchema.safeParse({ id: formData.get('id'), ...parseHolidayForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/hr/holidays/${parsed.data.id}`, { method: 'PUT', body: JSON.stringify(parsed.data) });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/holidays');
  redirect('/hr/holidays');
}
