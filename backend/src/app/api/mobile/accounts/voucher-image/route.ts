import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { authorize } from '@/server/auth/authorize';
import { storageGet } from '@/server/storage';
import { apiError } from '@/lib/api';
import { ApiError } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * Bearer-auth counterpart of the cookie-session `/api/transactions/voucher-image`
 * route left over from before the backend/web split — that one reads
 * `getSession()` off a NextAuth cookie, which web's cross-origin server-side
 * fetches never carry. Cash transfer / cash-in / cash-out image URLs minted
 * by `storeVoucherImage` point here instead.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const storagePath = req.nextUrl.searchParams.get('path');
  if (!storagePath) return Response.json(apiError('Missing voucher image path'), { status: 400 });

  try {
    await authorize(session, 'accounts:read');
    const body = new Uint8Array(await storageGet(storagePath));
    return new Response(body, {
      headers: {
        'Content-Type': 'image/*',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/voucher-image failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
