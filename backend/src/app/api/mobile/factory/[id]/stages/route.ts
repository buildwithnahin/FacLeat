import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { factoryService } from '@/server/services/factory.service';
import { productionStageCreateSchema } from '@/server/validators/factory';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productionStageCreateSchema.safeParse({ ...body, orderId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const stage = await factoryService.addStage(session, parsed.data);
    return Response.json(apiOk(stage), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/factory/${id}/stages failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
