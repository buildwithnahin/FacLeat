import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { notificationService } from '@/server/services/notification.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const unreadParam = searchParams.get('unread');
  const onlyUnread = unreadParam === '1' || unreadParam === 'true';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    const notifications = await notificationService.list(session, { onlyUnread, limit });
    return Response.json(apiOk(notifications));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/notifications failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
