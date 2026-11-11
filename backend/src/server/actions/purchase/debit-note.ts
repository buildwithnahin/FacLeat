'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { debitNoteCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';
import { parseItems, type PurchaseFormState } from './shared';

export async function createDebitNoteAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = debitNoteCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    supplierId: formData.get('supplierId'),
    warehouseId: formData.get('warehouseId'),
    invoiceId: formData.get('invoiceId') ?? '',
    grnId: formData.get('grnId') ?? '',
    returnDate: formData.get('returnDate'),
    reason: formData.get('reason') ?? '',
    vatAdjustment: formData.get('vatAdjustment') ?? 0,
    items: parseItems(formData),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await purchaseService.createDebitNote(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/returns');
  redirect('/purchase/returns');
}
