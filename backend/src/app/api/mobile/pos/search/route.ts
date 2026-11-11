import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { prisma } from '@/server/db';
import { posService } from '@/server/services/pos.service';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';

/**
 * Bearer-token counterpart of backend/src/app/api/pos/search/route.ts (which
 * stays cookie-session based for the old single-app path). Same branch
 * resolution: prefer the cashier's open session's branch over their active
 * branch, so a scan mid-sale keeps searching the till's own stock.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const q = req.nextUrl.searchParams.get('q') ?? '';

  try {
    const activeSession = await prisma.posSession.findFirst({
      where: { cashierId: session.userId, status: 'OPEN' },
      select: { branchId: true },
    });
    const branchId =
      req.nextUrl.searchParams.get('branchId') ??
      activeSession?.branchId ??
      session.activeBranchId ??
      session.defaultBranchId ??
      session.allowedBranchIds?.[0];
    if (!branchId) return Response.json(apiOk([]));

    const products = await posService.searchProducts(session, branchId, q, 40);
    return Response.json(apiOk(products));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/pos/search failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
