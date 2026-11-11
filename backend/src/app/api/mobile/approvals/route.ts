import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { approvalService } from '@/server/services/approval.service';

function parseBool(value: string | null) {
  return value === '1' || value === 'true';
}

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filters = {
    status: sp.get('status') ?? undefined,
    mine: parseBool(sp.get('mine')),
    forMe: parseBool(sp.get('forMe')),
  };

  try {
    const data = await approvalService.list(session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/approvals failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
