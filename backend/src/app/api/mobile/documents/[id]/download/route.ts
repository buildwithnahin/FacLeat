import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { documentService } from '@/server/services/document.service';
import { ApiError } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * Bearer-token twin of the legacy `/api/documents/[id]` cookie-session route
 * (still present, unmodified, under `backend/src/app/api/documents/`). web/
 * proxies through this for both the "Download" button and inline `<img>`
 * preview, since a browser can't attach an Authorization header to a plain
 * `<a href>` / `<img src>` request.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getMobileSession(req);
  if (!session) return new Response('Unauthorized', { status: 401 });

  try {
    const file = await documentService.download(session, id);
    const body = new Uint8Array(file.buffer);
    return new Response(body, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.size),
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return new Response(e.message, { status: e.status });
    }
    throw e;
  }
}
