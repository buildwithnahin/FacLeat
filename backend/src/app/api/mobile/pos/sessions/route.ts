import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { posService } from '@/server/services/pos.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const branchId = sp.get('branchId') ?? session.activeBranchId ?? undefined;
    const sessions = await posService.mySessions(session, 50, branchId);
    return Response.json(apiOk(sessions));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/pos/sessions failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
