import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { coaService } from '@/server/services/coa.service';
import { chartAccountCreateSchema } from '@/server/validators/coa';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const accounts = await coaService.list(session, {
      type: sp.get('type') ?? undefined,
      branchId: sp.get('branchId') ?? undefined,
      activeOnly: sp.get('activeOnly') === 'true',
    });
    return Response.json(apiOk(accounts));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/coa failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = chartAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const account = await coaService.create(session, parsed.data);
    return Response.json(apiOk(account), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/coa failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
