'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { companyCreateSchema, companyUpdateSchema } from '@/server/validators/companies';

export type CompanyFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function fieldErrorsFrom(e: BackendApiError): Record<string, string[]> | undefined {
  const details = e.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return details?.fieldErrors;
}

function parseForm(formData: FormData) {
  return {
    code: formData.get('code'),
    name: formData.get('name'),
    currency: formData.get('currency') ?? 'BDT',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    isActive: formData.get('isActive') === 'on',
  };
}

export async function createCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const parsed = companyCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/companies', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/companies');
  redirect('/companies');
}

export async function updateCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const id = String(formData.get('id') ?? '');
  const parsed = companyUpdateSchema.safeParse({ id, ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/companies/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/companies');
  redirect('/companies');
}
