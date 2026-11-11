import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope } from '@/server/auth/data-scope';
import { prisma } from '@/server/db';

/**
 * Scoped to wholesale — the new-invoice builder page needs a plain
 * active-warehouse picker for the current branch. Not a general warehouse
 * listing endpoint (that belongs to the warehouse module).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId;
  if (!branchId) return Response.json(apiOk([]));

  try {
    await authorize(session, 'wholesale:read');
    await assertBranchInScope(session, branchId);
    const warehouses = await prisma.warehouse.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, type: true },
    });
    return Response.json(apiOk(warehouses));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/wholesale/warehouses failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
