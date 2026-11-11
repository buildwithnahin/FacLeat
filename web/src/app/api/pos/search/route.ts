import { NextRequest } from 'next/server';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

/**
 * Thin same-origin proxy for the POS terminal's scan input, which does a
 * plain client-side `fetch` on every keystroke (see terminal.tsx). backendFetch
 * is server-only (it needs the NextAuth session to attach the Bearer token),
 * so the browser can't call backend/'s `/api/mobile/pos/search` directly —
 * this Route Handler is the bridge, mirroring the REST-surface pattern
 * CLAUDE.md calls out for scanner/live-search use cases.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const branchId = req.nextUrl.searchParams.get('branchId') ?? '';
  try {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (branchId) qs.set('branchId', branchId);
    const products = await backendFetch(`/api/mobile/pos/search?${qs.toString()}`);
    return Response.json(products);
  } catch (e) {
    if (e instanceof BackendApiError) {
      return Response.json([], { status: e.status === 401 ? 401 : 200 });
    }
    throw e;
  }
}
