import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { ecommerceService } from '@/server/services/ecommerce.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const updated = await ecommerceService.toggleChannelActive(session, id);
    return Response.json(apiOk(updated));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/ecommerce/channels/${id}/toggle failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
