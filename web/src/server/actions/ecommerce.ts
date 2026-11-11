'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  syncOrderSchema,
  packOrderSchema,
  fulfillOrderSchema,
  returnOrderSchema,
  reconcilePaymentsSchema,
} from '@/server/validators/ecommerce';

export async function syncEcommerceOrderAction(input: unknown) {
  const parsed = syncOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const order = await backendFetch<{ id: string; number: string }>('/api/mobile/ecommerce/orders', {
      method: 'POST',
      body: JSON.stringify({ ...parsed.data, warehouseId: parsed.data.warehouseId || undefined }),
    });
    revalidatePath('/ecommerce');
    revalidatePath('/ecommerce/orders');
    return { success: true, orderId: order.id, orderNumber: order.number };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function packEcommerceOrderAction(input: unknown) {
  const parsed = packOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await backendFetch(`/api/mobile/ecommerce/orders/${parsed.data.orderId}/pack`, { method: 'POST' });
    revalidatePath(`/ecommerce/orders/${parsed.data.orderId}`);
    revalidatePath('/ecommerce/orders');
    return { success: true };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function fulfillEcommerceOrderAction(input: unknown) {
  const parsed = fulfillOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await backendFetch(`/api/mobile/ecommerce/orders/${parsed.data.orderId}/fulfill`, {
      method: 'POST',
      body: JSON.stringify({
        ...parsed.data,
        courier: parsed.data.courier || undefined,
        trackingNo: parsed.data.trackingNo || undefined,
      }),
    });
    revalidatePath(`/ecommerce/orders/${parsed.data.orderId}`);
    revalidatePath('/ecommerce/orders');
    return { success: true };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function returnEcommerceOrderAction(input: unknown) {
  const parsed = returnOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const ret = await backendFetch<{ id: string }>(`/api/mobile/ecommerce/orders/${parsed.data.orderId}/return`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(`/ecommerce/orders/${parsed.data.orderId}`);
    revalidatePath('/ecommerce/orders');
    return { success: true, returnId: ret.id };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function reconcileEcommercePaymentsAction(input: unknown) {
  const parsed = reconcilePaymentsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const run = await backendFetch<{ id: string; matchedCount: number; unmatchedCount: number }>(
      '/api/mobile/ecommerce/reconcile',
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/ecommerce/reconcile');
    revalidatePath('/ecommerce');
    return { success: true, runId: run.id, matchedCount: run.matchedCount, unmatchedCount: run.unmatchedCount };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}
