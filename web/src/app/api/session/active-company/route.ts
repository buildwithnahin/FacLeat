import { NextRequest } from 'next/server';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

/**
 * Same-origin proxy for the company switcher — see
 * `../active-branch/route.ts` for the full rationale. Forwards to backend/'s
 * new Bearer-authenticated `/api/mobile/session/active-company`, which
 * persists to `User.activeCompanyId` (and resets `User.activeBranchId` to
 * the first branch in the newly-selected company).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    const data = await backendFetch<{ ok: boolean }>('/api/mobile/session/active-company', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return Response.json(data);
  } catch (err) {
    if (err instanceof BackendApiError) {
      return Response.json({ error: err.message, details: err.details }, { status: err.status });
    }
    return Response.json({ error: 'Failed to switch company' }, { status: 500 });
  }
}
