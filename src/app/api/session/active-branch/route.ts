import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACTIVE_BRANCH_BY_COMPANY_COOKIE,
  ACTIVE_BRANCH_COOKIE,
  parseActiveBranchByCompanyCookie,
} from '@/lib/cookies';
import { getSession } from '@/server/auth/session';
import { branchService } from '@/server/services/branch.service';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { branchId } = (await req.json()) as { branchId?: string };
  if (!branchId) return NextResponse.json({ error: 'branchId is required' }, { status: 400 });

  const branch = await branchService.getById(session, branchId);
  if (!branch.isActive) return NextResponse.json({ error: 'Branch is inactive' }, { status: 400 });
  if (session.activeCompanyId && branch.companyId !== session.activeCompanyId) {
    return NextResponse.json({ error: 'Branch does not belong to the active company' }, { status: 400 });
  }

  const store = await cookies();
  store.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  const branchByCompany = parseActiveBranchByCompanyCookie(
    store.get(ACTIVE_BRANCH_BY_COMPANY_COOKIE)?.value,
  );
  branchByCompany[branch.companyId] = branchId;
  store.set(ACTIVE_BRANCH_BY_COMPANY_COOKIE, JSON.stringify(branchByCompany), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
