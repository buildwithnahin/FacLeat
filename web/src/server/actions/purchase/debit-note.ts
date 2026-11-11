'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { debitNoteCreateSchema } from '@/server/validators/purchase';
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
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/purchase/returns', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/returns');
  redirect('/purchase/returns');
}
