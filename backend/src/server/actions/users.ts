'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession, invalidateRbacCache } from '@/server/auth/session';
import { userService } from '@/server/services/user.service';
import { userCreateSchema, userUpdateSchema } from '@/server/validators/users';
import { ApiError } from '@/lib/errors';

export type UserFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

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
    const session = await getSession();
    await userService.create(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  revalidatePath('/users');
  redirect('/users');
}

export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const parsed = userUpdateSchema.safeParse({ id: formData.get('id'), ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    await userService.update(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  invalidateRbacCache();
  revalidatePath('/users');
  redirect('/users');
}

export async function setUserStatusAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '') as 'ACTIVE' | 'DISABLED';
  if (!id || (status !== 'ACTIVE' && status !== 'DISABLED')) return;
  const session = await getSession();
  await userService.setStatus(session, id, status);
  invalidateRbacCache();
  revalidatePath('/users');
}
