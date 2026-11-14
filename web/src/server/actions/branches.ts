'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { branchCreateSchema, branchUpdateSchema } from '@/server/validators/branches';

export type BranchFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function fieldErrorsFrom(e: BackendApiError): Record<string, string[]> | undefined {
  const details = e.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return details?.fieldErrors;
}

function parseForm(formData: FormData) {
  return {
    code: formData.get('code'),
    name: formData.get('name'),
    type: formData.get('type') ?? 'MAIN',
    currency: formData.get('currency') ?? 'BDT',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    allowNegativeStock: formData.get('allowNegativeStock') === 'on',
    isActive: formData.get('isActive') === 'on',
  };
}

export async function createBranchAction(_prev: BranchFormState, formData: FormData): Promise<BranchFormState> {
  const parsed = branchCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/branches', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/branches');
  redirect('/branches');
}

export async function updateBranchAction(_prev: BranchFormState, formData: FormData): Promise<BranchFormState> {
  const id = String(formData.get('id') ?? '');
  const parsed = branchUpdateSchema.safeParse({ id, ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/branches/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/branches');
  redirect('/branches');
}
