import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, ValidationError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const date = sp.get('date');
  if (!date) return Response.json(apiError(new ValidationError('date is required')), { status: 422 });

  try {
    const result = await accountsService.dailyCashFlowDetails(session, {
      branchId: sp.get('branchId') ?? session.activeBranchId ?? undefined,
      date: new Date(`${date}T00:00:00.000Z`),
    });
    return Response.json(apiOk(result));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/daily-cash-flow/details failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
