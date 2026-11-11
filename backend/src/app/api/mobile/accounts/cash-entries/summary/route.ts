import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') === 'CASH_OUT' ? 'CASH_OUT' : 'CASH_IN';

  try {
    const result = await accountsService.cashEntrySummary(session, {
      type,
      branchId: sp.get('branchId') ?? session.activeBranchId ?? undefined,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(sp.get('to')!) : undefined,
    });
    return Response.json(
      apiOk({
        openingBalance: result.openingBalance,
        totalIn: result.totalIn,
        totalOut: result.totalOut,
        netBalance: result.netBalance,
        count: result.count,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/cash-entries/summary failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
