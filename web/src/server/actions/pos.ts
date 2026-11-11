'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  openSessionSchema,
  closeSessionSchema,
  createSaleSchema,
  refundSaleSchema,
} from '@/server/validators/pos';

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; saleId?: string; saleNumber?: string; returnId?: string; returnNumber?: string }
  | undefined;

export async function openPosSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = openSessionSchema.safeParse({
    branchId: formData.get('branchId'),
    warehouseId: formData.get('warehouseId'),
    openingFloat: formData.get('openingFloat') ?? 0,
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await backendFetch('/api/mobile/pos/open', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/pos');
  redirect('/pos');
}

export async function closePosSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = closeSessionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    countedCash: formData.get('countedCash') ?? 0,
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await backendFetch('/api/mobile/pos/close', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/pos');
  revalidatePath('/pos/sessions');
  redirect('/pos/sessions');
}

export async function createSaleAction(input: unknown) {
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const sale = await backendFetch<{ id: string; number: string }>('/api/mobile/pos/sales', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/pos');
    revalidatePath('/pos/sales');
    return { success: true, saleId: sale.id, saleNumber: sale.number };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function refundSaleAction(input: unknown) {
  const parsed = refundSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const ret = await backendFetch<{ id: string; number: string }>(
      `/api/mobile/pos/sales/${parsed.data.saleId}/refund`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/pos/sales');
    revalidatePath(`/pos/sales/${parsed.data.saleId}`);
    return { success: true, returnId: ret.id, returnNumber: ret.number };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}
