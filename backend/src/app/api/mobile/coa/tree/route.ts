import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { coaService } from '@/server/services/coa.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId') ?? undefined;

  try {
    const accounts = await coaService.tree(session, { branchId });
    return Response.json(apiOk(accounts));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/coa/tree failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
