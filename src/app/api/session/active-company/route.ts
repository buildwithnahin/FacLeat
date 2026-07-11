import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACTIVE_BRANCH_BY_COMPANY_COOKIE,
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_COMPANY_COOKIE,
  parseActiveBranchByCompanyCookie,
} from '@/lib/cookies';
import { getSession } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { prisma } from '@/server/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = (await req.json()) as { companyId?: string };
  if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

  const company = await companyService.getById(session, companyId);
  if (!company.isActive) return NextResponse.json({ error: 'Company is inactive' }, { status: 400 });

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
        ...(session.branchAccessType === 'ALL_BRANCHES' ? {} : { id: { in: session.allowedBranchIds } }),
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
        ...(session.branchAccessType === 'ALL_BRANCHES' ? {} : { id: { in: session.allowedBranchIds } }),
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

  return NextResponse.json({ ok: true });
}
