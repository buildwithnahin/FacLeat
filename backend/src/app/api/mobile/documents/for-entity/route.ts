import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { documentService } from '@/server/services/document.service';

/**
 * Backs a future `<DocumentsPanel entityType entityId>` the way
 * `for-entity/route.ts` under approvals backs `<ApprovalStatusBanner>` —
 * lets any module detail page list documents polymorphically linked to it.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const entityType = sp.get('entityType');
  const entityId = sp.get('entityId');
  if (!entityType || !entityId) {
    return Response.json(apiError('entityType and entityId are required'), { status: 400 });
  }

  try {
    const data = await documentService.listForEntity(session, entityType, entityId);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/documents/for-entity failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
