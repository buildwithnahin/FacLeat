'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { companyCreateSchema, companyUpdateSchema } from '@/server/validators/companies';
import { ApiError } from '@/lib/errors';
import {
  ACTIVE_BRANCH_BY_COMPANY_COOKIE,
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_COMPANY_COOKIE,
  parseActiveBranchByCompanyCookie,
} from '@/lib/cookies';
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
    isActive: formData.get('isActive') === 'on',
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

  const branchByCompany = parseActiveBranchByCompanyCookie(
    store.get(ACTIVE_BRANCH_BY_COMPANY_COOKIE)?.value,
  );

  let nextBranchId = branchByCompany[companyId] ?? null;

  if (nextBranchId) {
    const savedBranch = await prisma.branch.findFirst({
      where: {
        id: nextBranchId,
        companyId,
        isActive: true,
        ...(session.branchAccessType === 'ALL_BRANCHES'
          ? {}
          : { id: { in: session.allowedBranchIds } }),
      },
      select: { id: true },
    });
    if (!savedBranch) nextBranchId = null;
  }

  if (!nextBranchId) {
    const nextBranch = await prisma.branch.findFirst({
      where: {
        companyId,
        isActive: true,
        ...(session.branchAccessType === 'ALL_BRANCHES'
          ? {}
          : { id: { in: session.allowedBranchIds } }),
      },
      orderBy: [{ name: 'asc' }],
      select: { id: true },
    });
    nextBranchId = nextBranch?.id ?? null;
  }

  if (nextBranchId) {
    branchByCompany[companyId] = nextBranchId;
    store.set(ACTIVE_BRANCH_COOKIE, nextBranchId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    store.set(ACTIVE_BRANCH_BY_COMPANY_COOKIE, JSON.stringify(branchByCompany), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    store.delete(ACTIVE_BRANCH_COOKIE);
  }

  revalidatePath('/', 'layout');
}
