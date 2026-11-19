import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, NotFoundError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { stockService } from '@/server/services/stock.service';
import { Prisma } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    await authorize(session, 'warehouse:read');

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true, currency: true } },
      },
    });
    if (!warehouse) throw new NotFoundError('Warehouse not found');

    const [stockRows, recentMovements] = await Promise.all([
      stockService.balanceSnapshotDetailed(session, {
        branchId: warehouse.branchId,
        warehouseId: warehouse.id,
      }),
      prisma.inventoryLedger.findMany({
        where: { warehouseId: warehouse.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    let totalUnits = new Prisma.Decimal(0);
    let totalCostValue = new Prisma.Decimal(0);
    let totalSellValue = new Prisma.Decimal(0);
    let lowStockCount = 0;

    const stock = stockRows.map((r) => {
      const qty = new Prisma.Decimal(r.qty);
      const costPrice = new Prisma.Decimal(r.product.costPrice);
      const sellPrice = new Prisma.Decimal(r.product.sellPrice);
      const reorderLevel = new Prisma.Decimal(r.product.reorderLevel);

      totalUnits = totalUnits.plus(qty);
      totalCostValue = totalCostValue.plus(qty.times(costPrice));
      totalSellValue = totalSellValue.plus(qty.times(sellPrice));

      if (reorderLevel.gt(0) && qty.lte(reorderLevel)) {
        lowStockCount++;
      }

      return {
        product: {
          id: r.product.id,
          sku: r.product.sku,
          name: r.product.name,
          unit: r.product.unit,
          type: r.product.type,
          costPrice: r.product.costPrice.toString(),
          sellPrice: r.product.sellPrice.toString(),
          reorderLevel: r.product.reorderLevel.toString(),
        },
        qty: qty.toString(),
        costValue: qty.times(costPrice).toFixed(2),
        sellValue: qty.times(sellPrice).toFixed(2),
        isLowStock: reorderLevel.gt(0) && qty.lte(reorderLevel),
      };
    });

    return Response.json(
      apiOk({
        warehouse,
        stock,
        recentMovements: recentMovements.map((m) => ({
          id: m.id,
          date: m.createdAt.toISOString(),
          product: m.product,
          direction: m.direction,
          quantity: m.quantity.toString(),
          refType: m.refType,
          note: m.note,
          actor: m.createdBy?.name || m.createdBy?.email || 'System',
        })),
        summary: {
          totalUnits: totalUnits.toString(),
          totalCostValue: totalCostValue.toFixed(2),
          totalSellValue: totalSellValue.toFixed(2),
          itemsCount: stock.length,
          lowStockCount,
        },
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/warehouse/warehouses/${id}/stock failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
