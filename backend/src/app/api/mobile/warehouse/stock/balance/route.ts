import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockService } from '@/server/services/stock.service';
import { ApiError } from '@/lib/errors';

/**
 * Raw {productId, warehouseId, balance} rows — used by the physical count
 * screen to show "System qty" per warehouse without shipping the whole
 * product/warehouse catalog (that's balanceSnapshotDetailed, exposed
 * separately under /api/mobile/inventory/stock).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId');
  if (!branchId) return Response.json(apiError('branchId is required'), { status: 400 });
  const warehouseId = sp.get('warehouseId') ?? undefined;

  try {
    const rows = await stockService.balanceSnapshot(session, branchId, warehouseId);
    return Response.json(
      apiOk(
        rows.map((r) => ({
          productId: r.productId,
          warehouseId: r.warehouseId,
          balance: r.balance.toString(),
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/stock/balance failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
