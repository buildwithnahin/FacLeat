import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { invalidateRbacCache } from '@/server/auth/session';
import { branchService } from '@/server/services/branch.service';
import { prisma } from '@/server/db';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';

/**
 * Bearer-authenticated twin of the legacy cookie-based
 * `/api/session/active-branch` route. That route reads/writes an HttpOnly
 * cookie scoped to backend/'s own origin via `getSession()` — unreachable
 * from web/'s browser (different origin) and meaningless to the stateless
 * mobile session anyway. This route instead persists the selection to
 * `User.activeBranchId`, which `buildSessionForUser` (server/auth/session.ts)
 * now reads as the default active branch for BOTH the cookie-based web
 * session and this Bearer session — one shared source of truth.
 */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = (await req.json().catch(() => null)) as { branchId?: string } | null;
  const branchId = body?.branchId;
  if (!branchId) return Response.json(apiError('branchId is required'), { status: 400 });

  try {
    const branch = await branchService.getById(session, branchId);
    if (!branch.isActive) {
      return Response.json(apiError('Branch is inactive'), { status: 400 });
    }
    if (session.activeCompanyId && branch.companyId !== session.activeCompanyId) {
      return Response.json(apiError('Branch does not belong to the active company'), { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { activeBranchId: branchId },
    });
    invalidateRbacCache();

    return Response.json(apiOk({ ok: true }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/session/active-branch failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
