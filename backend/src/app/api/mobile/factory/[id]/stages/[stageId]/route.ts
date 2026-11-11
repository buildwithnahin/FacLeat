import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { factoryService } from '@/server/services/factory.service';
import { productionStageUpdateSchema } from '@/server/validators/factory';

type RouteParams = { params: Promise<{ id: string; stageId: string }> };

/**
 * Stage status update. Not wired to any button in the current UI (the root
 * `production-controls.tsx` never called `updateStageAction` either) but
 * kept for parity with the service layer's capability.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { stageId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productionStageUpdateSchema.safeParse({ ...body, stageId });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const stage = await factoryService.updateStage(session, parsed.data);
    return Response.json(apiOk(stage));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/factory/${stageId}/stages failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
