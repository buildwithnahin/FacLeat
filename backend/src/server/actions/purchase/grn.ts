'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { grnCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await purchaseService.createGrn(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/grn');
  revalidatePath(`/purchase/orders/${parsed.data.purchaseOrderId}`);
  redirect('/purchase/grn');
}
