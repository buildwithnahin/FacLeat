import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { coaService } from '@/server/services/coa.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const isActive = Boolean(body?.isActive);

  try {
    const account = await coaService.toggleActive(session, id, isActive);
    return Response.json(apiOk(account));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/coa/${id}/toggle failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
