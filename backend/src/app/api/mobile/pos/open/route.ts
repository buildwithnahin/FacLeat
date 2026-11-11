import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { getScopedBranchIds } from '@/server/auth/data-scope';
import { posService } from '@/server/services/pos.service';
import { openSessionSchema } from '@/server/validators/pos';

/**
 * Mirrors src/app/(app)/pos/open/page.tsx: form options (branches / eligible
 * till warehouses) plus whatever should pre-fill the opening-balance field
 * (carried over from the cashier's last closed session).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branchIds = await getScopedBranchIds(session);

    const existing = await prisma.posSession.findFirst({
      where: {
        cashierId: session.userId,
        status: 'OPEN',
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
    });
    if (existing) {
      return Response.json(apiOk({ hasOpenSession: true }));
    }

    const [branches, warehouses, lastClosed] = await Promise.all([
      prisma.branch.findMany({
        where: {
          isActive: true,
          ...(branchIds ? { id: { in: branchIds } } : {}),
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, currency: true },
      }),
      prisma.warehouse.findMany({
        where: {
          isActive: true,
          type: { in: ['STORE', 'SHOWROOM', 'MAIN'] },
          ...(branchIds ? { branchId: { in: branchIds } } : {}),
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, branchId: true },
      }),
      prisma.posSession.findFirst({
        where: { cashierId: session.userId, status: 'CLOSED' },
        orderBy: { closedAt: 'desc' },
        select: { countedCash: true },
      }),
    ]);

    const defaultBranch = session.activeBranchId ?? branches[0]?.id ?? '';
    const defaultOpeningBalance = lastClosed ? lastClosed.countedCash.toString() : '0';

    return Response.json(
      apiOk({
        hasOpenSession: false,
        branches,
        warehouses,
        defaultBranch,
        defaultOpeningBalance,
        carriedFromPrevious: !!lastClosed,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/pos/open failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = openSessionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const created = await posService.openSession(session, parsed.data);
    return Response.json(apiOk(created));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/pos/open failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
