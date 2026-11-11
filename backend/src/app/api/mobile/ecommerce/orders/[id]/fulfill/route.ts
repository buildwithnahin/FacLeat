import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { ecommerceService } from '@/server/services/ecommerce.service';
import { fulfillOrderSchema } from '@/server/validators/ecommerce';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = fulfillOrderSchema.safeParse({ ...body, orderId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const order = await ecommerceService.fulfillOrder(session, {
      ...parsed.data,
      courier: parsed.data.courier || undefined,
      trackingNo: parsed.data.trackingNo || undefined,
    });
    return Response.json(apiOk(order));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/ecommerce/orders/${id}/fulfill failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
