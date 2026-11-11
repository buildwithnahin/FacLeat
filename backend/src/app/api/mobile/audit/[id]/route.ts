import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, NotFoundError } from '@/lib/errors';
import { auditService } from '@/server/services/audit.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    const entry = await auditService.getById(session, id);
    if (!entry) throw new NotFoundError('Audit log entry not found');
    return Response.json(apiOk(entry));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/audit/${id} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
