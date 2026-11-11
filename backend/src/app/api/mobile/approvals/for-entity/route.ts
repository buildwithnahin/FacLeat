import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { approvalService } from '@/server/services/approval.service';

/**
 * Backs `<ApprovalStatusBanner>` — shown on many module detail pages (sales
 * invoices, purchase orders, journals, etc.) to surface an in-flight approval
 * request for that specific record, if any.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const module = sp.get('module');
  const entityType = sp.get('entityType');
  const entityId = sp.get('entityId');
  if (!module || !entityType || !entityId) {
    return Response.json(apiError('module, entityType, and entityId are required'), { status: 400 });
  }

  try {
    const request = await approvalService.findLatestForEntity(session, { module, entityType, entityId });
    return Response.json(apiOk(request));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/approvals/for-entity failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
