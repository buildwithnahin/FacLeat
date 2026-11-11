'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { poCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';
import { parseItems, type PurchaseFormState } from './shared';

export async function createPurchaseOrderAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = poCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    supplierId: formData.get('supplierId'),
    requisitionId: formData.get('requisitionId') ?? '',
    deliveryDate: formData.get('deliveryDate'),
    orderDate: formData.get('orderDate') ?? undefined,
    currency: formData.get('currency') ?? 'BDT',
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
    await purchaseService.createPurchaseOrder(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/orders');
  redirect('/purchase/orders');
}

export async function approvePurchaseOrderAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid PO id');
  const session = await getSession();
  try {
    await purchaseService.approvePurchaseOrder(session, id);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  revalidatePath('/purchase/orders');
  revalidatePath(`/purchase/orders/${id}`);
}

export async function cancelPurchaseOrderAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid PO id');
  const session = await getSession();
  await purchaseService.cancelPurchaseOrder(session, id);
  revalidatePath('/purchase/orders');
  revalidatePath(`/purchase/orders/${id}`);
}
