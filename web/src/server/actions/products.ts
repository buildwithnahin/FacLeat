'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { productCreateSchema, productUpdateSchema } from '@/server/validators/products';

export type ProductFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function parseForm(formData: FormData) {
  return {
    sku: formData.get('sku'),
    barcodeMode: formData.get('barcodeMode') ?? 'generate',
    barcode: formData.get('barcode') ?? '',
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    size: formData.get('size') ?? '',
    type: formData.get('type') ?? 'FINISHED_GOOD',
    unit: formData.get('unit') ?? 'PCS',
    categoryId: formData.get('categoryId') ?? '',
    brandId: formData.get('brandId') ?? '',
    costPrice: formData.get('costPrice') ?? '0',
    sellPrice: formData.get('sellPrice') ?? '0',
    taxRate: formData.get('taxRate') ?? '15',
    reorderLevel: formData.get('reorderLevel') ?? '0',
    reorderQty: formData.get('reorderQty') ?? '0',
    isActive: formData.get('isActive') !== 'off',
    imageUrl: formData.get('imageUrl') ?? '',
  };
}

export async function createProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const parsed = productCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/inventory/products', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/inventory/products');
  redirect('/inventory/products');
}

export async function assignBarcodeAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await backendFetch(`/api/mobile/inventory/products/${id}/assign-barcode`, { method: 'POST' });
  } catch (e) {
    if (e instanceof BackendApiError) throw new Error(e.message);
    throw e;
  }
  revalidatePath('/inventory/products');
  revalidatePath('/barcode');
}

export async function updateProductAction(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const parsed = productUpdateSchema.safeParse({ id: formData.get('id'), ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/inventory/products/${parsed.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/inventory/products');
  redirect('/inventory/products');
}
