'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { runDecisionAndRedirect } from '@/lib/decision-notice';
import { invoiceCreateSchema } from '@/server/validators/purchase';
import { parseItems, type PurchaseFormState } from './shared';

export async function createInvoiceAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = invoiceCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    supplierId: formData.get('supplierId'),
    purchaseOrderId: formData.get('purchaseOrderId') ?? '',
    grnId: formData.get('grnId') ?? '',
    invoiceDate: formData.get('invoiceDate'),
    dueDate: formData.get('dueDate'),
    currency: formData.get('currency') ?? 'BDT',
    discountTotal: formData.get('discountTotal') ?? 0,
    notes: formData.get('notes') ?? '',
    items: parseItems(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/purchase/invoices', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/invoices');
  redirect('/purchase/invoices');
}

export async function approveInvoiceAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid invoice id');
  await runDecisionAndRedirect(
    () => backendFetch(`/api/mobile/purchase/invoices/${id}/approve`, { method: 'POST' }),
    `/purchase/invoices/${id}`,
    '/purchase/invoices',
  );
}
