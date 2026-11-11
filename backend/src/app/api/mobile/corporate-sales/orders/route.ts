import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { corporateService } from '@/server/services/corporate-sales.service';
import { createOrderSchema } from '@/server/validators/corporate-sales';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const orders = await corporateService.listOrders(session, {
      status: sp.get('status') ?? undefined,
      search: sp.get('search') ?? undefined,
      branchId:
        sp.get('branchId') ??
        session.activeBranchId ??
        session.defaultBranchId ??
        session.allowedBranchIds?.[0] ??
        undefined,
    });
    return Response.json(apiOk(orders));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/corporate-sales/orders failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const order = await corporateService.createOrder(session, parsed.data);
    return Response.json(apiOk(order));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/corporate-sales/orders failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
