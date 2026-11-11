'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { roleCreateSchema, roleUpdateSchema } from '@/server/validators/roles';

export type RoleFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function fieldErrorsFrom(e: BackendApiError): Record<string, string[]> | undefined {
  const details = e.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return details?.fieldErrors;
}

function parseForm(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    permissionKeys: formData.getAll('permissionKeys'),
  };
}

export async function createRoleAction(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const parsed = roleCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch('/api/mobile/roles', { method: 'POST', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/roles');
  redirect('/roles');
}

export async function updateRoleAction(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const id = String(formData.get('id') ?? '');
  const parsed = roleUpdateSchema.safeParse({ id, ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    await backendFetch(`/api/mobile/roles/${id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) });
  } catch (e) {
    if (e instanceof BackendApiError) {
      const fieldErrors = fieldErrorsFrom(e);
      if (fieldErrors) return { fieldErrors };
      return { error: e.message };
    }
    throw e;
  }

  revalidatePath('/roles');
  redirect('/roles');
}

export async function deleteRoleAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await backendFetch(`/api/mobile/roles/${id}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof BackendApiError) throw new Error(e.message);
    throw e;
  }
  revalidatePath('/roles');
}
