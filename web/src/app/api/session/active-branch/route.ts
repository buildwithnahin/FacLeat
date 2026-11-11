import { NextRequest } from 'next/server';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

/**
 * Same-origin proxy for the branch switcher (`switcher-dropdown.tsx` posts
 * here with a plain client-side `fetch`, which can't attach the NextAuth
 * session's Bearer token itself). Reads the session server-side and forwards
 * to backend/'s new Bearer-authenticated `/api/mobile/session/active-branch`,
 * which persists the selection to `User.activeBranchId` — the backend/'s
 * legacy cookie-based `/api/session/active-branch` route this used to (try
 * to) hit lived on a different origin and never actually worked from here.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    const data = await backendFetch<{ ok: boolean }>('/api/mobile/session/active-branch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return Response.json(data);
  } catch (err) {
    if (err instanceof BackendApiError) {
      return Response.json({ error: err.message, details: err.details }, { status: err.status });
    }
    return Response.json({ error: 'Failed to switch branch' }, { status: 500 });
  }
}
