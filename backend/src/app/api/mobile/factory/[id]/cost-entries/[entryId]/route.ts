import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { factoryService } from '@/server/services/factory.service';
import { productionCostEntryDeleteSchema } from '@/server/validators/factory';

type RouteParams = { params: Promise<{ id: string; entryId: string }> };

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id, entryId } = await params;
  const parsed = productionCostEntryDeleteSchema.safeParse({ orderId: id, entryId });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const result = await factoryService.deleteCostEntry(session, parsed.data);
    return Response.json(apiOk(result));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`DELETE /api/mobile/factory/${id}/cost-entries/${entryId} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
