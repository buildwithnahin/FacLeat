import { authorize } from '@/server/auth/authorize';
import { getSession } from '@/server/auth/session';
import { storageGet } from '@/server/storage';
import { ApiError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storagePath = url.searchParams.get('path');
  if (!storagePath) {
    return new Response('Missing voucher image path', { status: 400 });
  }

  try {
    await authorize(await getSession(), 'accounts:read');
    const body = new Uint8Array(await storageGet(storagePath));
    return new Response(body, {
      headers: {
        'Content-Type': 'image/*',
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
