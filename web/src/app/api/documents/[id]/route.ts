import { auth } from '@/server/auth/config';

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const runtime = 'nodejs';

/**
 * Same-origin proxy for document bytes. The document detail page renders
 * `<a href="/api/documents/{id}">` (download) and `<img src="/api/documents/{id}">`
 * (inline preview) exactly like the pre-split app did — neither tag can attach
 * an Authorization header, so this route holds the Bearer token server-side
 * and streams backend/'s response straight through.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.backendAccessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/api/mobile/documents/${id}/download`, {
    headers: { Authorization: `Bearer ${session.backendAccessToken}` },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    return new Response(text || 'Failed to fetch document', { status: res.status });
  }

  const headers = new Headers();
  for (const h of ['content-type', 'content-length', 'content-disposition', 'cache-control']) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.body, { status: 200, headers });
}
