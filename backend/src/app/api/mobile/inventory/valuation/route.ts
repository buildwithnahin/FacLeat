import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { reportsService } from '@/server/services/reports.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;

  try {
    const valuation = await reportsService.inventoryValuation(session, { branchId });
    return Response.json(
      apiOk({
        rows: valuation.rows.map((r) => ({
          productId: r.productId,
          sku: r.sku,
          name: r.name,
          unit: r.unit,
          type: r.type,
          qty: r.qty.toString(),
          cost: r.cost.toString(),
          value: r.value.toString(),
          reorderLevel: r.reorderLevel.toString(),
          belowReorder: r.belowReorder,
        })),
        totals: {
          qty: valuation.totals.qty.toString(),
          value: valuation.totals.value.toString(),
        },
        bySection: valuation.bySection.map((s) => ({
          section: s.section,
          label: s.label,
          qty: s.qty.toString(),
          value: s.value.toString(),
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/inventory/valuation failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
