'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { ecommerceService } from '@/server/services/ecommerce.service';
import {
  syncOrderSchema,
  packOrderSchema,
  fulfillOrderSchema,
  returnOrderSchema,
  reconcilePaymentsSchema,
} from '@/server/validators/ecommerce';
import { ApiError } from '@/lib/errors';

export async function syncEcommerceOrderAction(input: unknown) {
  const parsed = syncOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    const order = await ecommerceService.syncOrder(session, {
      ...parsed.data,
      warehouseId: parsed.data.warehouseId || undefined,
    });
    revalidatePath('/ecommerce');
    revalidatePath('/ecommerce/orders');
    return { success: true, orderId: order.id, orderNumber: order.number };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
    const session = await getSession();
    await ecommerceService.packOrder(session, parsed.data.orderId);
    revalidatePath(`/ecommerce/orders/${parsed.data.orderId}`);
    revalidatePath('/ecommerce/orders');
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
    const session = await getSession();
    await ecommerceService.fulfillOrder(session, {
      ...parsed.data,
      courier: parsed.data.courier || undefined,
      trackingNo: parsed.data.trackingNo || undefined,
    });
    revalidatePath(`/ecommerce/orders/${parsed.data.orderId}`);
    revalidatePath('/ecommerce/orders');
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
    const session = await getSession();
    const ret = await ecommerceService.returnOrder(session, parsed.data);
    revalidatePath(`/ecommerce/orders/${parsed.data.orderId}`);
    revalidatePath('/ecommerce/orders');
    return { success: true, returnId: ret.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
    const session = await getSession();
    const run = await ecommerceService.reconcilePayments(session, parsed.data);
    revalidatePath('/ecommerce/reconcile');
    revalidatePath('/ecommerce');
    return { success: true, runId: run.id, matchedCount: run.matchedCount, unmatchedCount: run.unmatchedCount };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}
