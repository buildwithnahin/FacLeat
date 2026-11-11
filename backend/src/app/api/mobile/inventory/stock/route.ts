import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockService } from '@/server/services/stock.service';
import { parseInventorySection } from '@/lib/inventory-sections';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId') ?? '';
  const warehouseId = sp.get('warehouseId') ?? undefined;
  const section = parseInventorySection(sp.get('section'));

  try {
    const rows = await stockService.balanceSnapshotDetailed(session, { branchId, warehouseId, section });
    return Response.json(
      apiOk(
        rows.map((r) => ({
          product: {
            id: r.product.id,
            sku: r.product.sku,
            name: r.product.name,
            unit: r.product.unit,
            type: r.product.type,
            reorderLevel: r.product.reorderLevel.toString(),
            costPrice: r.product.costPrice.toString(),
            sellPrice: r.product.sellPrice.toString(),
          },
          warehouse: {
            id: r.warehouse.id,
            name: r.warehouse.name,
            code: r.warehouse.code,
            type: r.warehouse.type,
          },
          qty: r.qty.toString(),
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/stock failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
