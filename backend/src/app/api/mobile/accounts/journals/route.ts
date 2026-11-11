import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';
import { journalCreateSchema } from '@/server/validators/accounts';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') as 'DRAFT' | 'POSTED' | 'VOIDED' | null;
  const takeParam = sp.get('take');

  try {
    const entries = await accountsService.listEntries(session, {
      branchId: sp.get('branchId') ?? undefined,
      status: status ?? undefined,
      from: sp.get('from') ? new Date(sp.get('from')!) : undefined,
      to: sp.get('to') ? new Date(sp.get('to')!) : undefined,
      accountId: sp.get('accountId') ?? undefined,
      take: takeParam ? Number(takeParam) : undefined,
    });
    return Response.json(apiOk(entries));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/journals failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = journalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const entry = await accountsService.postJournal(session, parsed.data);
    return Response.json(apiOk(entry), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/accounts/journals failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
