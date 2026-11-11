import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { ecommerceService } from '@/server/services/ecommerce.service';
import { warehouseService } from '@/server/services/warehouse.service';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Order + the warehouse picker list in one call — matches
 * src/app/(app)/ecommerce/orders/[id]/page.tsx, which loaded both to render
 * the order detail and the fulfillment form's warehouse dropdown together.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const order = await ecommerceService.getOrder(session, id);
    const warehouses = await warehouseService.listActiveForBranch(session, order.branchId);
    return Response.json(apiOk({ order, warehouses }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/ecommerce/orders/${id} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
