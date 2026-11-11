import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { wholesaleService } from '@/server/services/wholesale.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId ?? undefined;

  try {
    const stats = await wholesaleService.dashboardStats(session, branchId ?? undefined);
    return Response.json(apiOk(stats));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/wholesale/dashboard failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
