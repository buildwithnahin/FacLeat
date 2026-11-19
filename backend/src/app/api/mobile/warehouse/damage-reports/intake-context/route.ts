import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { warehouseService } from '@/server/services/warehouse.service';
import { requireWarehouseByType } from '@/server/services/warehouse-workflows.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId');
  if (!branchId) return Response.json(apiError('branchId is required'), { status: 400 });

  try {
    await authorize(session, 'inventory:damage', { branchId });

    const [warehouses, quarantine, products] = await Promise.all([
      warehouseService.listActiveForBranch(session, branchId),
      requireWarehouseByType(branchId, 'QUARANTINE'),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, sku: true, barcode: true, name: true, unit: true, costPrice: true },
      }),
    ]);

    return Response.json(
      apiOk({
        warehouses: warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code })),
        quarantineWarehouse: quarantine ? { id: quarantine.id, name: quarantine.name, code: quarantine.code } : null,
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          unit: p.unit,
          costPrice: p.costPrice.toString(),
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/damage-reports/intake-context failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
