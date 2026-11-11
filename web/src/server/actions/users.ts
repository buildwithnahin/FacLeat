'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { userCreateSchema, userUpdateSchema } from '@/server/validators/users';

export type UserFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function fieldErrorsFrom(e: BackendApiError): Record<string, string[]> | undefined {
  const details = e.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return details?.fieldErrors;
}

function parseForm(formData: FormData) {
  return {
    employeeId: formData.get('employeeId'),
    email: formData.get('email'),
    password: formData.get('password') ?? '',
    defaultBranchId: formData.get('defaultBranchId') ?? '',
    branchAccessType: formData.get('branchAccessType') ?? 'OWN_BRANCH_ONLY',
    assignedBranchIds: formData
      .getAll('assignedBranchIds')
      .map((value) => String(value))
      .filter(Boolean),
    status: formData.get('status') ?? 'ACTIVE',
    roleId: formData.get('roleId'),
  };
}

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const parsed = userCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/users', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/users');
  redirect('/users');
}

export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const id = String(formData.get('id') ?? '');
  const parsed = userUpdateSchema.safeParse({ id, ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/users/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/users');
  redirect('/users');
}

export async function setUserStatusAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || (status !== 'ACTIVE' && status !== 'DISABLED')) return;
  await backendFetch(`/api/mobile/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  revalidatePath('/users');
}
