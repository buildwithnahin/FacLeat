import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, ValidationError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) {
    return Response.json(apiError(new ValidationError('from and to are required')), { status: 422 });
  }

  try {
    const result = await accountsService.dailyCashFlow(session, {
      branchId: sp.get('branchId') ?? session.activeBranchId ?? undefined,
      from: new Date(from),
      to: new Date(`${to}T23:59:59.999Z`),
    });
    return Response.json(
      apiOk({
        userName: session.name,
        summary: {
          openingBalance: result.summary.openingBalance,
          totalIn: result.summary.totalIn,
          totalOut: result.summary.totalOut,
          netBalance: result.summary.netBalance,
          closingBalance: result.summary.closingBalance,
        },
        rows: result.rows,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/daily-cash-flow failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
