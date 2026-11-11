import { backendFetch } from '@/lib/backend-client';

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Lets the client-side `NotificationBell` open a live SSE connection to
 * backend/'s `/api/mobile/sse/notifications` even though `backendFetch` (and
 * the NextAuth session it reads) is server-only. Reads the session
 * server-side, trades it for a short-lived SSE-only token via backend/'s
 * `/api/mobile/sse/token`, and hands the client just enough to connect:
 * the token plus backend/'s origin (already public — same value as
 * `NEXT_PUBLIC_API_URL`).
 */
export async function GET() {
  try {
    const { token } = await backendFetch<{ token: string }>('/api/mobile/sse/token');
    return Response.json({ success: true, token, backendUrl: BACKEND_URL });
  } catch {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
}
