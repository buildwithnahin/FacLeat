import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { notificationService } from '@/server/services/notification.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const count = await notificationService.unreadCount(session);
    return Response.json(apiOk({ count }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/notifications/unread-count failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
