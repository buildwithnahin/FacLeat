import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { ecommerceService } from '@/server/services/ecommerce.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId ?? undefined;
  try {
    const channels = await ecommerceService.listChannels(session, branchId ?? undefined);
    return Response.json(apiOk(channels));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/ecommerce/channels failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
