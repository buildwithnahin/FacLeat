import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, NotFoundError } from '@/lib/errors';
import { factoryService } from '@/server/services/factory.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    const data = await factoryService.getCostingSheetData(session, id);
    return Response.json(apiOk(data));
  } catch (err) {
    // Root page.tsx treats *any* failure (not just NotFoundError) here as
    // notFound() — preserved via a plain 404 for non-ApiError failures too.
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/factory/${id}/costing-sheet failed`, err);
    return Response.json(apiError(new NotFoundError('Production order not found')), { status: 404 });
  }
}
