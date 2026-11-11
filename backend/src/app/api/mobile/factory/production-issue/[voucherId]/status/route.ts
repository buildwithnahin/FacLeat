import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { productionIssueStatusSchema } from '@/server/validators/factory';

type RouteParams = { params: Promise<{ voucherId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { voucherId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = productionIssueStatusSchema.safeParse({ ...body, voucherId });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const voucher = await factoryWorkflowService.changeProductionIssueStatus(session, parsed.data);
    return Response.json(apiOk(voucher));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/factory/production-issue/${voucherId}/status failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
