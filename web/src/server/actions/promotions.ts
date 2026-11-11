'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  promotionCreateSchema,
  promotionStatusActionSchema,
  promotionUpdateSchema,
} from '@/server/validators/promotions';

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
    const record = await backendFetch<{ id: string }>('/api/mobile/hr/promotions', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/hr/promotions');
    return { success: true, id: record.id };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
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
    await backendFetch(`/api/mobile/hr/promotions/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
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

  try {
    await backendFetch(`/api/mobile/hr/promotions/${parsed.data.id}/status`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }

  revalidatePath('/hr/promotions');
  revalidatePath('/hr/employees');
}
