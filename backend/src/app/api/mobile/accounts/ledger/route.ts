import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const accountId = sp.get('accountId');
  if (!accountId) return Response.json(apiError('accountId is required'), { status: 422 });

  try {
    const ledger = await accountsService.accountLedger(session, {
      accountId,
      branchId: sp.get('branchId') ?? undefined,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(sp.get('to')!) : undefined,
    });
    return Response.json(apiOk(ledger));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/ledger failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
