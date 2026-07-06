'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { companyCreateSchema, companyUpdateSchema } from '@/server/validators/companies';
import { ApiError } from '@/lib/errors';
import { ACTIVE_BRANCH_COOKIE, ACTIVE_COMPANY_COOKIE } from '@/lib/cookies';
import { prisma } from '@/server/db';

export type CompanyFormState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

function parseForm(formData: FormData) {
  return {
    code: formData.get('code'),
    name: formData.get('name'),
    currency: formData.get('currency') ?? 'BDT',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    isActive: formData.get('isActive') !== 'off',
  };
}

export async function createCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const parsed = companyCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    await companyService.create(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  revalidatePath('/companies');
  redirect('/companies');
}

export async function updateCompanyAction(_prev: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const parsed = companyUpdateSchema.safeParse({ id: formData.get('id'), ...parseForm(formData) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    await companyService.update(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  revalidatePath('/companies');
  redirect('/companies');
}

export async function setActiveCompanyAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  if (!companyId) return;
  const session = await getSession();
  if (!session) return;
  // validate the company exists + is active
  const company = await companyService.getById(session, companyId);
  if (!company.isActive) return;

  const store = await cookies();
  store.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  // If the currently active branch doesn't belong to the newly active company,
  // clear the branch cookie so the branch switcher re-selects within the new company.
  const currentBranchId = store.get(ACTIVE_BRANCH_COOKIE)?.value;
  if (currentBranchId) {
    const currentBranch = await prisma.branch.findUnique({
      where: { id: currentBranchId },
      select: { companyId: true },
    });
    if (currentBranch?.companyId !== companyId) {
      store.delete(ACTIVE_BRANCH_COOKIE);
    }
  }

  revalidatePath('/', 'layout');
}
