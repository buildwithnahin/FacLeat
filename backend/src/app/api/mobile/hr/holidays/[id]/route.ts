import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { holidaysService } from '@/server/services/holidays.service';
import { holidayUpdateSchema } from '@/server/validators/holidays';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  try {
    const h = await holidaysService.getById(session, id);
    return Response.json(
      apiOk({
        id: h.id,
        name: h.name,
        code: h.code,
        startDate: h.startDate.toISOString(),
        endDate: h.endDate.toISOString(),
        type: h.type,
        branchId: h.branchId,
        isPaid: h.isPaid,
        status: h.status,
        description: h.description,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/holidays/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = holidayUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    await holidaysService.update(session, parsed.data);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PUT /api/mobile/hr/holidays/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
