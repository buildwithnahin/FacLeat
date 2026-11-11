import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { signSseToken } from '@/server/auth/mobile-jwt';
import { apiError, apiOk } from '@/lib/api';

/**
 * Mints a short-lived, single-purpose token for `/api/mobile/sse/notifications`.
 * A plain `EventSource` can't send an `Authorization` header, so the SSE route
 * has to authenticate off a `?token=` query param instead — this endpoint lets
 * a normal Bearer-authenticated caller (web/'s NextAuth session, or the mobile
 * app) trade its access token for one scoped to just that stream, so the
 * primary access token never has to appear in a URL/log/browser history.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const token = await signSseToken(session.userId);
  return Response.json(apiOk({ token }));
}
