'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  createInvoiceSchema,
  recordPaymentSchema,
  returnInvoiceSchema,
  voidInvoiceSchema,
} from '@/server/validators/wholesale';

function fail(e: unknown) {
  if (e instanceof BackendApiError) return { error: e.message };
  throw e;
}

export async function createWholesaleInvoiceAction(input: unknown) {
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const invoice = await backendFetch<{ id: string; number: string }>(
      '/api/mobile/wholesale/invoices',
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/wholesale');
    revalidatePath('/wholesale/invoices');
    return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.number };
  } catch (e) {
    return fail(e);
  }
}

export async function recordWholesalePaymentAction(input: unknown) {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const payment = await backendFetch<{ id: string }>(
      `/api/mobile/wholesale/invoices/${parsed.data.invoiceId}/payments`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath(`/wholesale/invoices/${parsed.data.invoiceId}`);
    revalidatePath('/wholesale/invoices');
    return { success: true, paymentId: payment.id };
  } catch (e) {
    return fail(e);
  }
}

export async function returnWholesaleInvoiceAction(input: unknown) {
  const parsed = returnInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const ret = await backendFetch<{ id: string; number: string }>(
      `/api/mobile/wholesale/invoices/${parsed.data.invoiceId}/return`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath(`/wholesale/invoices/${parsed.data.invoiceId}`);
    revalidatePath('/wholesale/invoices');
    return { success: true, returnId: ret.id, returnNumber: ret.number };
  } catch (e) {
    return fail(e);
  }
}

export async function voidWholesaleInvoiceAction(input: unknown) {
  const parsed = voidInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await backendFetch(`/api/mobile/wholesale/invoices/${parsed.data.invoiceId}/void`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(`/wholesale/invoices/${parsed.data.invoiceId}`);
    revalidatePath('/wholesale/invoices');
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}
