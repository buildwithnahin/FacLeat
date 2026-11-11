import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { LoansService } from '@/server/services/loans.service';
import { loanFormSchema } from '@/server/validators/loans';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const loans = await LoansService.getLoans(session, {
      search: sp.get('q') ?? undefined,
      type: sp.get('type') ?? undefined,
      status: sp.get('status') ?? undefined,
    });
    return Response.json(apiOk(loans));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/loans-advances failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = loanFormSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const loan = await LoansService.createLoan(session, parsed.data);
    return Response.json(apiOk(loan));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/loans-advances failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
