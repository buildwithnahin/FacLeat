import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { customerService } from '@/server/services/customer.service';
import { customerCreateSchema } from '@/server/validators/crm';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const customers = await customerService.list(session, {
      status: sp.get('status') ?? undefined,
      type: sp.get('type') ?? undefined,
      search: sp.get('search') ?? undefined,
    });
    return Response.json(apiOk(customers));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/crm failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = customerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const customer = await customerService.create(session, parsed.data);
    return Response.json(apiOk(customer));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/crm failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
