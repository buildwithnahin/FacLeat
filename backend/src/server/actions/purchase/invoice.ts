'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { invoiceCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await purchaseService.createInvoice(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/invoices');
  redirect('/purchase/invoices');
}

export async function approveInvoiceAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid invoice id');
  const session = await getSession();
  try {
    await purchaseService.approveInvoice(session, id);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  revalidatePath('/purchase/invoices');
  revalidatePath(`/purchase/invoices/${id}`);
}
