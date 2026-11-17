'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryTypeCreateSchema,
} from '@/server/validators/product-categories';

export type CategoryFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function parseForm(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    type: formData.get('type') ?? '',
    parentId: formData.get('parentId') ?? '',
  };
}

export async function createCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const parsed = categoryCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/inventory/categories', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/inventory/categories');
  redirect('/inventory/categories');
}

export async function updateCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const parsed = categoryUpdateSchema.safeParse({ id: formData.get('id'), ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/inventory/categories/${parsed.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/inventory/categories');
  redirect('/inventory/categories');
}

export async function createCategoryTypeAction(
  _prev: { error?: string; success?: boolean; type?: any } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean; type?: any }> {
  const name = formData.get('name') as string;
  const code = (formData.get('code') as string) || '';
  const description = (formData.get('description') as string) || '';

  const parsed = categoryTypeCreateSchema.safeParse({ name, code, description });
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const firstError = Object.values(flattened.fieldErrors)[0]?.[0] || 'Validation error';
    return { error: firstError };
  }

  try {
    const res = await backendFetch<any>('/api/mobile/inventory/categories/types', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/inventory/categories');
    revalidatePath('/inventory/categories/new');
    return { success: true, type: res };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    return { error: 'Failed to create category type' };
  }
}
