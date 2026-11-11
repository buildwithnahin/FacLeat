import { NextRequest } from 'next/server';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

/**
 * Thin proxy for `LineItemsEditor`'s client-side `fetch(searchUrl)` calls —
 * the browser can't hit backend/ directly (it doesn't hold the Bearer
 * token), so this Route Handler runs server-side, attaches it via
 * `backendFetch`, and forwards the product list straight through.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const branchId = req.nextUrl.searchParams.get('branchId') ?? '';
  const qs = new URLSearchParams({ q });
  if (branchId) qs.set('branchId', branchId);

  try {
    const products = await backendFetch(`/api/mobile/corporate-sales/products/search?${qs.toString()}`);
    return Response.json(products);
  } catch (e) {
    if (e instanceof BackendApiError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
