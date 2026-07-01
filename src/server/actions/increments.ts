'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import {
  incrementsService,
  INCREMENT_TABLE_UNAVAILABLE_MESSAGE,
  isEmployeeIncrementTableMissingError,
} from '@/server/services/increments.service';
import {
  incrementCreateSchema,
  incrementStatusActionSchema,
  incrementUpdateSchema,
} from '@/server/validators/increments';
import { ApiError } from '@/lib/errors';

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
    const session = await getSession();
    const record = await incrementsService.create(session, parsed.data);
    revalidatePath('/hr/increments');
    return { success: true, id: record.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeIncrementTableMissingError(error)) return { error: INCREMENT_TABLE_UNAVAILABLE_MESSAGE };
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
    const session = await getSession();
    await incrementsService.update(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeIncrementTableMissingError(error)) return { error: INCREMENT_TABLE_UNAVAILABLE_MESSAGE };
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

  const session = await getSession();
  try {
    await incrementsService.changeStatus(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return;
    if (isEmployeeIncrementTableMissingError(error)) return;
    throw error;
  }

  revalidatePath('/hr/increments');
  revalidatePath('/hr/employees');
}
