import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, ValidationError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

const TYPES = ['CASH_IN', 'CASH_OUT', 'CASH_TRANSFER', 'BULK'] as const;

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');
  if (!type || !(TYPES as readonly string[]).includes(type)) {
    return Response.json(apiError(new ValidationError('Invalid voucher type')), { status: 422 });
  }

  try {
    const rows = await accountsService.listVouchers(session, {
      branchId: sp.get('branchId') ?? undefined,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(`${sp.get('to')}T23:59:59.999Z`) : undefined,
      type: type as (typeof TYPES)[number],
    });
    return Response.json(apiOk(rows));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/vouchers failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
