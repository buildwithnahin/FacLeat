import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { getScopedBranchIds } from '@/server/auth/data-scope';
import { posService } from '@/server/services/pos.service';

/**
 * One round trip for the POS terminal screen: the cashier's currently open
 * session (if any) plus the initial product grid and customer picker list.
 * Mirrors what src/app/(app)/pos/page.tsx assembled via three sequential
 * Prisma calls before the backend/web split.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId;
    const branchIds = await getScopedBranchIds(session, branchId);
    const openSession = await prisma.posSession.findFirst({
      where: {
        cashierId: session.userId,
        status: 'OPEN',
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, code: true, currency: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    if (!openSession) {
      return Response.json(apiOk({ openSession: null }));
    }

    const [products, customers] = await Promise.all([
      posService.searchProducts(session, openSession.branchId, '', 40),
      prisma.customer.findMany({
        where: { branchId: openSession.branchId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        take: 500,
        select: { id: true, code: true, name: true, type: true, creditLimit: true },
      }),
    ]);

    return Response.json(
      apiOk({
        openSession: {
          id: openSession.id,
          branchId: openSession.branchId,
          warehouseId: openSession.warehouseId,
          branchName: openSession.branch.name,
          warehouseName: openSession.warehouse.name,
          currency: openSession.branch.currency,
          cashierName: session.name,
          openedAt: openSession.openedAt,
        },
        products,
        customers,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/pos/terminal failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
