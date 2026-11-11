'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  createQuoteSchema,
  updateQuoteStatusSchema,
  convertQuoteSchema,
  createOrderSchema,
  cancelOrderSchema,
  recordDeliverySchema,
  updateDeliveryWorkflowSchema,
  createInvoiceSchema,
  recordInvoicePaymentSchema,
} from '@/server/validators/corporate-sales';

function fail(e: unknown) {
  if (e instanceof BackendApiError) return { error: e.message };
  throw e;
}

export async function createCorporateQuoteAction(input: unknown) {
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const quote = await backendFetch<{ id: string; number: string }>(
      '/api/mobile/corporate-sales/quotes',
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/corporate-sales');
    revalidatePath('/corporate-sales/quotes');
    return { success: true, quoteId: quote.id, quoteNumber: quote.number };
  } catch (e) {
    return fail(e);
  }
}

export async function updateCorporateQuoteStatusAction(input: unknown) {
  const parsed = updateQuoteStatusSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/corporate-sales/quotes/${parsed.data.quoteId}/status`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(`/corporate-sales/quotes/${parsed.data.quoteId}`);
    revalidatePath('/corporate-sales/quotes');
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function convertCorporateQuoteAction(input: unknown) {
  const parsed = convertQuoteSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const order = await backendFetch<{ id: string; number: string }>(
      `/api/mobile/corporate-sales/quotes/${parsed.data.quoteId}/convert`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath(`/corporate-sales/quotes/${parsed.data.quoteId}`);
    revalidatePath('/corporate-sales/orders');
    return { success: true, orderId: order.id, orderNumber: order.number };
  } catch (e) {
    return fail(e);
  }
}

export async function createCorporateOrderAction(input: unknown) {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const order = await backendFetch<{ id: string; number: string }>(
      '/api/mobile/corporate-sales/orders',
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/corporate-sales');
    revalidatePath('/corporate-sales/orders');
    return { success: true, orderId: order.id, orderNumber: order.number };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelCorporateOrderAction(input: unknown) {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/corporate-sales/orders/${parsed.data.orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(`/corporate-sales/orders/${parsed.data.orderId}`);
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function recordCorporateDeliveryAction(input: unknown) {
  const parsed = recordDeliverySchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const delivery = await backendFetch<{ id: string; number: string }>(
      `/api/mobile/corporate-sales/orders/${parsed.data.orderId}/deliveries`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath(`/corporate-sales/orders/${parsed.data.orderId}`);
    return { success: true, deliveryId: delivery.id, deliveryNumber: delivery.number };
  } catch (e) {
    return fail(e);
  }
}

export async function updateCorporateDeliveryWorkflowAction(input: unknown) {
  const parsed = updateDeliveryWorkflowSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/corporate-sales/deliveries/${parsed.data.deliveryId}/workflow`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/warehouse/dispatch');
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createCorporateInvoiceAction(input: unknown) {
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const invoice = await backendFetch<{ id: string; number: string }>(
      `/api/mobile/corporate-sales/orders/${parsed.data.orderId}/invoices`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath(`/corporate-sales/orders/${parsed.data.orderId}`);
    revalidatePath('/corporate-sales/invoices');
    return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.number };
  } catch (e) {
    return fail(e);
  }
}

export async function recordCorporateInvoicePaymentAction(input: unknown) {
  const parsed = recordInvoicePaymentSchema.safeParse(input);
  if (!parsed.success)
    return { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/corporate-sales/invoices/${parsed.data.invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(`/corporate-sales/invoices/${parsed.data.invoiceId}`);
    revalidatePath('/corporate-sales/invoices');
    return { success: true };
  } catch (e) {
    return fail(e);
  }
}
