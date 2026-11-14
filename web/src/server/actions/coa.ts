'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { chartAccountCreateSchema, chartAccountUpdateSchema } from '@/server/validators/coa';

export type CoaFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

function parseForm(formData: FormData) {
  const parentId = formData.get('parentId');
  const branchId = formData.get('branchId');
  const openingBalanceDate = formData.get('openingBalanceDate');
  return {
    code: String(formData.get('code') ?? '').toUpperCase(),
    name: formData.get('name'),
    type: formData.get('type'),
    normalSide: formData.get('normalSide'),
    parentId: parentId && String(parentId) ? String(parentId) : null,
    isPosting: formData.get('isPosting') !== 'off',
    isControl: formData.get('isControl') === 'on',
    currency: formData.get('currency') ?? 'BDT',
    branchId: branchId && String(branchId) ? String(branchId) : null,
    openingBalance: formData.get('openingBalance') ?? 0,
    description: formData.get('description') ?? '',
    isActive: formData.get('isActive') !== 'off',
    detailType: formData.get('detailType') ?? '',
    openingBalanceDate:
      openingBalanceDate && String(openingBalanceDate) ? String(openingBalanceDate) : null,
  };
}

export async function createChartAccountAction(
  _prev: CoaFormState,
  formData: FormData,
): Promise<CoaFormState> {
  const parsed = chartAccountCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/coa', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }

  revalidatePath('/coa');
  redirect('/coa');
}

export async function createChartAccountInlineAction(input: {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  normalSide: 'DEBIT' | 'CREDIT';
  branchId?: string | null;
  description?: string;
}): Promise<{
  success: boolean;
  error?: string;
  account?: { id: string; code: string; name: string; type: string };
}> {
  const parsed = chartAccountCreateSchema.safeParse({
    code: input.code.toUpperCase().trim(),
    name: input.name.trim(),
    type: input.type,
    normalSide: input.normalSide,
    parentId: null,
    isPosting: true,
    isControl: false,
    currency: 'BDT',
    branchId: input.branchId || null,
    openingBalance: 0,
    description: input.description ?? '',
    isActive: true,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
    };
  }

  try {
    const res = await backendFetch<{ id: string; code: string; name: string; type: string }>(
      '/api/mobile/coa',
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/accounts/journals/new');
    revalidatePath('/coa');
    return { success: true, account: res };
  } catch (e) {
    if (e instanceof BackendApiError) return { success: false, error: e.message };
    return { success: false, error: 'Failed to create account' };
  }
}

export async function toggleActiveAction(id: string, isActive: boolean): Promise<void> {
  try {
    await backendFetch(`/api/mobile/coa/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ isActive }),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }
  revalidatePath('/coa');
}

export async function deleteChartAccountAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    await backendFetch(`/api/mobile/coa/${id}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/coa');
  redirect('/coa');
}

export async function updateChartAccountAction(
  _prev: CoaFormState,
  formData: FormData,
): Promise<CoaFormState> {
  const parsed = chartAccountUpdateSchema.safeParse({ id: formData.get('id'), ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/coa/${parsed.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }

  revalidatePath('/coa');
  redirect('/coa');
}
