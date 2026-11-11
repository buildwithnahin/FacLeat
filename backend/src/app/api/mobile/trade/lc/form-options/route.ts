import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { tradeService } from '@/server/services/trade.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId =
    req.nextUrl.searchParams.get('branchId') ??
    session.activeBranchId ??
    session.defaultBranchId ??
    session.allowedBranchIds?.[0] ??
    undefined;
  try {
    const data = await tradeService.getLCFormOptions(session, branchId);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/trade/lc/form-options failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
