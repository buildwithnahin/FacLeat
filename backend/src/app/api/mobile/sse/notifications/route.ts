import { NextRequest } from 'next/server';
import { verifySseToken } from '@/server/auth/mobile-jwt';
import { subscribe } from '@/server/notifications/publisher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Token-in-query-string twin of `/api/sse/notifications` (which authenticates
 * via the cookie-based `getSession()` and is unreachable from web/'s origin).
 * A plain browser `EventSource` can only hit a URL — it can't attach a Bearer
 * header — so this route accepts the token as `?token=`, verifies it with
 * `verifySseToken` (see `mobile-jwt.ts`; only accepts tokens minted by
 * `/api/mobile/sse/token`, not the general access token), and then reuses the
 * exact same `publisher.subscribe()` fanout the cookie-based route uses.
 *
 * Do NOT touch `/api/sse/notifications` — other callers may still depend on
 * the cookie-based variant.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const userId = await verifySseToken(token);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      // hello
      send({ type: 'connected', userId });

      const unsub = subscribe(userId, (payload) => send(payload));

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, 25_000);

      const abort = () => {
        clearInterval(keepAlive);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', abort);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
