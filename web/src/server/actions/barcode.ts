'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

/**
 * Bound directly to a `<form action={assignBarcodeAction}>` (see (app)/barcode/page.tsx),
 * mirroring the root app's `assignBarcodeAction` in `server/actions/products.ts`. Split
 * out here rather than porting that whole shared products-actions file, since the rest
 * of it (`updateProductAction`, etc.) belongs to the not-yet-migrated Inventory module.
 */
export async function assignBarcodeAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await backendFetch(`/api/mobile/barcode/products/${id}/assign`, { method: 'POST' });
  } catch (e) {
    if (e instanceof BackendApiError) throw new Error(e.message);
    throw e;
  }
  revalidatePath('/barcode');
}
