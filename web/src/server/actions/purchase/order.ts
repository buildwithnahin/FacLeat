'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { runDecisionAndRedirect } from '@/lib/decision-notice';
import { poCreateSchema } from '@/server/validators/purchase';
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
    await backendFetch('/api/mobile/purchase/orders', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/orders');
  redirect('/purchase/orders');
}

export async function approvePurchaseOrderAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid PO id');
  await runDecisionAndRedirect(
    () => backendFetch(`/api/mobile/purchase/orders/${id}/approve`, { method: 'POST' }),
    `/purchase/orders/${id}`,
    '/purchase/orders',
  );
}

export async function cancelPurchaseOrderAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid PO id');
  await backendFetch(`/api/mobile/purchase/orders/${id}/cancel`, { method: 'POST' });
  revalidatePath('/purchase/orders');
  revalidatePath(`/purchase/orders/${id}`);
}
