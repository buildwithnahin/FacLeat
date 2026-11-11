import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockService } from '@/server/services/stock.service';
import { parseInventorySection } from '@/lib/inventory-sections';
import { ApiError } from '@/lib/errors';

/**
 * Backs the inventory ledger page, the inventory overview's "recent
 * movements" widget, and the warehouse "issued products" log — all three
 * are stockService.listMovements with a different filter combination, so
 * one flexible query-param surface instead of three near-identical routes.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const direction = sp.get('direction');
  const from = sp.get('from');
  const to = sp.get('to');

  try {
    const rows = await stockService.listMovements(session, {
      branchId: sp.get('branchId') ?? undefined,
      warehouseId: sp.get('warehouseId') ?? undefined,
      productId: sp.get('productId') ?? undefined,
      direction: direction === 'IN' || direction === 'OUT' ? direction : undefined,
      refType: sp.get('refType') ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
      section: parseInventorySection(sp.get('section')),
    });
    return Response.json(
      apiOk(
        rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          direction: r.direction,
          quantity: r.quantity.toString(),
          costPerUnit: r.costPerUnit.toString(),
          refType: r.refType,
          refId: r.refId,
          note: r.note,
          productId: r.productId,
          warehouseId: r.warehouseId,
          product: { sku: r.product.sku, name: r.product.name, unit: r.product.unit, type: r.product.type },
          warehouse: { code: r.warehouse.code, name: r.warehouse.name, type: r.warehouse.type },
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/movements failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
