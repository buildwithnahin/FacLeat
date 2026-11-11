import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const entry = await accountsService.postDraft(session, id);
    return Response.json(apiOk(entry));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/accounts/journals/${id}/post failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
