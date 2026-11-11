'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  incrementCreateSchema,
  incrementStatusActionSchema,
  incrementUpdateSchema,
} from '@/server/validators/increments';

export type IncrementFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; id?: string }
  | undefined;

function parseIncrementForm(fd: FormData) {
  return {
    employeeId: fd.get('employeeId'),
    incrementType: fd.get('incrementType'),
    incrementMethod: fd.get('incrementMethod'),
    incrementValue: fd.get('incrementValue'),
    effectiveDate: fd.get('effectiveDate'),
    reason: fd.get('reason'),
    performanceSummary: fd.get('performanceSummary') ?? '',
    remarks: fd.get('remarks') ?? '',
  };
}

export async function createIncrementAction(
  _prev: IncrementFormState,
  fd: FormData,
): Promise<IncrementFormState> {
  const parsed = incrementCreateSchema.safeParse(parseIncrementForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const record = await backendFetch<{ id: string }>('/api/mobile/hr/increments', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/hr/increments');
    return { success: true, id: record.id };
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
}

export async function updateIncrementAction(
  _prev: IncrementFormState,
  fd: FormData,
): Promise<IncrementFormState> {
  const parsed = incrementUpdateSchema.safeParse({
    id: fd.get('id'),
    ...parseIncrementForm(fd),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    await backendFetch(`/api/mobile/hr/increments/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/increments');
  redirect('/hr/increments');
}

export async function changeIncrementStatusAction(fd: FormData) {
  const parsed = incrementStatusActionSchema.safeParse({
    id: fd.get('id'),
    action: fd.get('action'),
    note: fd.get('note') ?? '',
    budgetVerified: fd.get('budgetVerified') ?? undefined,
  });
  if (!parsed.success) return;

  try {
    await backendFetch(`/api/mobile/hr/increments/${parsed.data.id}/status`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return;
    throw error;
  }

  revalidatePath('/hr/increments');
  revalidatePath('/hr/employees');
}
