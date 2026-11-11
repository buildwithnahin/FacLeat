import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { invalidateRbacCache } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { prisma } from '@/server/db';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';

/**
 * Bearer-authenticated twin of the legacy cookie-based
 * `/api/session/active-company` route — see active-branch/route.ts for why
 * the cookie version can't work from web/'s origin or for mobile sessions.
 * Persists to `User.activeCompanyId`/`activeBranchId`.
 *
 * Simplification vs. the legacy route: the cookie version remembered the
 * last-used branch per company (`ACTIVE_BRANCH_BY_COMPANY_COOKIE`) so
 * re-selecting a company restored your previous branch there. This route
 * doesn't persist a full per-company branch history — switching company
 * always resets to the first active branch you can access in it. Revisit
 * with a small per-user/per-company mapping table if that nicety is missed.
 */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = (await req.json().catch(() => null)) as { companyId?: string } | null;
  const companyId = body?.companyId;
  if (!companyId) return Response.json(apiError('companyId is required'), { status: 400 });

  try {
    const company = await companyService.getById(session, companyId);
    if (!company.isActive) {
      return Response.json(apiError('Company is inactive'), { status: 400 });
    }

    const nextBranch = await prisma.branch.findFirst({
      where: {
        companyId,
        isActive: true,
        ...(session.branchAccessType === 'ALL_BRANCHES' ? {} : { id: { in: session.allowedBranchIds } }),
      },
      orderBy: [{ name: 'asc' }],
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: session.userId },
      data: { activeCompanyId: companyId, activeBranchId: nextBranch?.id ?? null },
    });
    invalidateRbacCache();

    return Response.json(apiOk({ ok: true }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/session/active-company failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
