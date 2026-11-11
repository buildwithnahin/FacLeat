import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { documentService } from '@/server/services/document.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { linkId } = await params;
  try {
    await documentService.unlink(session, linkId);
    return Response.json(apiOk({ linkId }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('DELETE /api/mobile/documents/link/[linkId] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
