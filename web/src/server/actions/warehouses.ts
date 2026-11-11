'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { warehouseCreateSchema, warehouseUpdateSchema } from '@/server/validators/warehouses';

export type WarehouseFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function parseForm(formData: FormData) {
  return {
    branchId: formData.get('branchId'),
    code: formData.get('code'),
    name: formData.get('name'),
    type: formData.get('type') ?? 'MAIN',
    address: formData.get('address') ?? '',
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  };
}

export async function createWarehouseAction(_prev: WarehouseFormState, formData: FormData): Promise<WarehouseFormState> {
  const parsed = warehouseCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await backendFetch('/api/mobile/warehouse/warehouses', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/warehouse');
  redirect('/warehouse');
}

export async function updateWarehouseAction(_prev: WarehouseFormState, formData: FormData): Promise<WarehouseFormState> {
  const parsed = warehouseUpdateSchema.safeParse({ id: formData.get('id'), ...parseForm(formData) });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await backendFetch(`/api/mobile/warehouse/warehouses/${parsed.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/warehouse');
  redirect('/warehouse');
}
