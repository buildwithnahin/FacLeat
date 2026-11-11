'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import {
  isEmployeePromotionTableMissingError,
  PROMOTION_TABLE_UNAVAILABLE_MESSAGE,
  promotionsService,
} from '@/server/services/promotions.service';
import {
  promotionCreateSchema,
  promotionStatusActionSchema,
  promotionUpdateSchema,
} from '@/server/validators/promotions';
import { ApiError } from '@/lib/errors';

export type PromotionFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; id?: string }
  | undefined;

function parsePromotionForm(fd: FormData) {
  return {
    employeeId: fd.get('employeeId'),
    promotionType: fd.get('promotionType'),
    newDesignation: fd.get('newDesignation'),
    newSalary: fd.get('newSalary'),
    effectiveDate: fd.get('effectiveDate'),
    reason: fd.get('reason'),
    remarks: fd.get('remarks') ?? '',
  };
}

export async function createPromotionAction(
  _prev: PromotionFormState,
  fd: FormData,
): Promise<PromotionFormState> {
  const parsed = promotionCreateSchema.safeParse(parsePromotionForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    const record = await promotionsService.create(session, parsed.data);
    revalidatePath('/hr/promotions');
    return { success: true, id: record.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    if (isEmployeePromotionTableMissingError(e)) return { error: PROMOTION_TABLE_UNAVAILABLE_MESSAGE };
    throw e;
  }
}

export async function updatePromotionAction(
  _prev: PromotionFormState,
  fd: FormData,
): Promise<PromotionFormState> {
  const parsed = promotionUpdateSchema.safeParse({
    id: fd.get('id'),
    ...parsePromotionForm(fd),
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
    await promotionsService.update(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    if (isEmployeePromotionTableMissingError(e)) return { error: PROMOTION_TABLE_UNAVAILABLE_MESSAGE };
    throw e;
  }

  revalidatePath('/hr/promotions');
  redirect('/hr/promotions');
}

export async function changePromotionStatusAction(fd: FormData) {
  const parsed = promotionStatusActionSchema.safeParse({
    id: fd.get('id'),
    action: fd.get('action'),
    note: fd.get('note') ?? '',
  });
  if (!parsed.success) return;

  const session = await getSession();
  try {
    await promotionsService.changeStatus(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return;
    if (isEmployeePromotionTableMissingError(e)) return;
    throw e;
  }

  revalidatePath('/hr/promotions');
  revalidatePath('/hr/employees');
}
