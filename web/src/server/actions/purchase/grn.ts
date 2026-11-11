'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { grnCreateSchema } from '@/server/validators/purchase';
import { parseItems, type PurchaseFormState } from './shared';

export async function createGrnAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = grnCreateSchema.safeParse({
    purchaseOrderId: formData.get('purchaseOrderId'),
    warehouseId: formData.get('warehouseId'),
    receivedDate: formData.get('receivedDate'),
    notes: formData.get('notes') ?? '',
    items: parseItems(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/purchase/grn', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/grn');
  revalidatePath(`/purchase/orders/${parsed.data.purchaseOrderId}`);
  redirect('/purchase/grn');
}
