import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { promotionsService } from '@/server/services/promotions.service';
import { promotionUpdateSchema } from '@/server/validators/promotions';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const record = await promotionsService.getById(session, id);
    return Response.json(apiOk(record));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/promotions/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = promotionUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const record = await promotionsService.update(session, parsed.data);
    return Response.json(apiOk(record));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PUT /api/mobile/hr/promotions/[id] failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
