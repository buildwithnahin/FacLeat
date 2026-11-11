import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { authorize } from '@/server/auth/authorize';
import { googleDriveStorage } from '@/server/storage/google-drive';
import { backblazeStorage } from '@/server/storage/backblaze';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'settings:write');
    const body = await req.json().catch(() => ({}));
    const driver = typeof body?.driver === 'string' ? body.driver : 'google-drive';

    if (driver === 'backblaze') {
      await backblazeStorage.testConnection();
      return Response.json(apiOk({ success: true }));
    }

    const folderId = typeof body?.folderId === 'string' ? body.folderId : '';
    if (!folderId) return Response.json(apiError('folderId is required'), { status: 422 });

    await googleDriveStorage.testConnection(folderId);
    return Response.json(apiOk({ success: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection test failed';
    // Mirrors the old server action's contract: always 200, success flag carries the result,
    // so the client form can render "failed" without treating it as a request-level error.
    return Response.json(apiOk({ success: false, error: msg }));
  }
}
