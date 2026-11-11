'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  customerCreateSchema,
  customerUpdateSchema,
  customerInteractionSchema,
} from '@/server/validators/crm';

export type CustomerFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

function parseCustomer(formData: FormData) {
  return {
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    type: formData.get('type') ?? 'RETAIL',
    categoryId: formData.get('categoryId') ?? '',
    contactPerson: formData.get('contactPerson') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    address: formData.get('address') ?? '',
    city: formData.get('city') ?? '',
    country: formData.get('country') ?? '',
    taxId: formData.get('taxId') ?? '',
    creditLimit: formData.get('creditLimit') ?? 0,
    creditDays: formData.get('creditDays') ?? 0,
    currency: formData.get('currency') ?? 'BDT',
    openingBalance: formData.get('openingBalance') ?? 0,
    status: formData.get('status') ?? 'ACTIVE',
    notes: formData.get('notes') ?? '',
  };
}

export async function createCustomerAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = customerCreateSchema.safeParse(parseCustomer(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/crm', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/crm');
  redirect('/crm');
}

export async function updateCustomerAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const parsed = customerUpdateSchema.safeParse({
    id: formData.get('id'),
    ...parseCustomer(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/crm/${parsed.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/crm');
  redirect(`/crm/${parsed.data.id}`);
}

export type InteractionFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

export async function addCustomerInteractionAction(
  _prev: InteractionFormState,
  formData: FormData,
): Promise<InteractionFormState> {
  const followUpRaw = formData.get('followUpAt');
  const parsed = customerInteractionSchema.safeParse({
    customerId: formData.get('customerId'),
    type: formData.get('type') ?? 'NOTE',
    subject: formData.get('subject'),
    body: formData.get('body') ?? '',
    followUpAt: followUpRaw ? followUpRaw : null,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/crm/${parsed.data.customerId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/crm/${parsed.data.customerId}`);
  return { success: true };
}
