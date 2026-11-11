'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import {
  confirmationsService,
  CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE,
  isEmployeeConfirmationTableMissingError,
} from '@/server/services/confirmations.service';
import {
  confirmationCreateSchema,
  confirmationStatusActionSchema,
  confirmationUpdateSchema,
} from '@/server/validators/confirmations';
import { ApiError } from '@/lib/errors';

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
    const session = await getSession();
    const record = await confirmationsService.create(session, parsed.data);
    revalidatePath('/hr/confirmations');
    return { success: true, id: record.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeConfirmationTableMissingError(error)) return { error: CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE };
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
    const session = await getSession();
    await confirmationsService.update(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeConfirmationTableMissingError(error)) return { error: CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE };
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

  const session = await getSession();
  try {
    await confirmationsService.changeStatus(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`/hr/confirmations?error=${encodeURIComponent(error.message)}`);
    }
    if (isEmployeeConfirmationTableMissingError(error)) {
      redirect(`/hr/confirmations?error=${encodeURIComponent(CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE)}`);
    }
    throw error;
  }

  revalidatePath('/hr/confirmations');
  revalidatePath('/hr/employees');
  redirect('/hr/confirmations');
}
