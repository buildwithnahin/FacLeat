import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { ecommerceService } from '@/server/services/ecommerce.service';
import { syncOrderSchema } from '@/server/validators/ecommerce';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const branchId =
    sp.get('branchId') ??
    session.activeBranchId ??
    session.defaultBranchId ??
    session.allowedBranchIds?.[0] ??
    undefined;
  try {
    const orders = await ecommerceService.listOrders(session, {
      branchId: branchId ?? undefined,
      channelId: sp.get('channelId') ?? undefined,
      status: sp.get('status') ?? undefined,
      search: sp.get('search') ?? undefined,
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    });
    return Response.json(apiOk(orders));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/ecommerce/orders failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

/**
 * Not driven by any current web page (orders arrive via real channel sync in
 * production), but keeps the mobile surface complete against
 * ecommerceService.syncOrder / syncOrderSchema for whichever caller ends up
 * pushing manual/test orders.
 */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = syncOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const order = await ecommerceService.syncOrder(session, {
      ...parsed.data,
      warehouseId: parsed.data.warehouseId || undefined,
    });
    return Response.json(apiOk(order));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/ecommerce/orders failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
