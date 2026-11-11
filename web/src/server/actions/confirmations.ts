'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  confirmationCreateSchema,
  confirmationStatusActionSchema,
  confirmationUpdateSchema,
} from '@/server/validators/confirmations';

export type ConfirmationFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined>; success?: boolean; id?: string }
  | undefined;

function parseConfirmationForm(fd: FormData) {
  return {
    employeeId: fd.get('employeeId'),
    confirmationType: fd.get('confirmationType'),
    probationEndDate: fd.get('probationEndDate') ?? '',
    effectiveDate: fd.get('effectiveDate'),
    salaryRevisionRequired: fd.get('salaryRevisionRequired') ?? 'no',
    incrementAmount: fd.get('incrementAmount') ?? '',
    benefitsRevision: fd.get('benefitsRevision') ?? '',
    reason: fd.get('reason'),
    performanceSummary: fd.get('performanceSummary') ?? '',
    remarks: fd.get('remarks') ?? '',
  };
}

export async function createConfirmationAction(
  _prev: ConfirmationFormState,
  fd: FormData,
): Promise<ConfirmationFormState> {
  const parsed = confirmationCreateSchema.safeParse(parseConfirmationForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const record = await backendFetch<{ id: string }>('/api/mobile/hr/confirmations', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/hr/confirmations');
    return { success: true, id: record.id };
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
}

export async function updateConfirmationAction(
  _prev: ConfirmationFormState,
  fd: FormData,
): Promise<ConfirmationFormState> {
  const parsed = confirmationUpdateSchema.safeParse({
    id: fd.get('id'),
    ...parseConfirmationForm(fd),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    await backendFetch(`/api/mobile/hr/confirmations/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/confirmations');
  redirect('/hr/confirmations');
}

export async function changeConfirmationStatusAction(fd: FormData) {
  const parsed = confirmationStatusActionSchema.safeParse({
    id: fd.get('id'),
    action: fd.get('action'),
    note: fd.get('note') ?? '',
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const message = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? 'Invalid confirmation action';
    redirect(`/hr/confirmations?error=${encodeURIComponent(message)}`);
  }

  try {
    await backendFetch(`/api/mobile/hr/confirmations/${parsed.data.id}/status`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) {
      redirect(`/hr/confirmations?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath('/hr/confirmations');
  revalidatePath('/hr/employees');
  redirect('/hr/confirmations');
}
