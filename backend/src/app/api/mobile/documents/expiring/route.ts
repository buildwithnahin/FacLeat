import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { documentService } from '@/server/services/document.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const daysParam = req.nextUrl.searchParams.get('days');
  const days = daysParam ? Number(daysParam) : 30;

  try {
    const data = await documentService.expiringSoon(session, Number.isFinite(days) ? days : 30);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/documents/expiring failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
