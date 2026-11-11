import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { approvalService } from '@/server/services/approval.service';
import { approvalRuleSchema } from '@/server/validators/approvals';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const data = await approvalService.listRules(session);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/approvals/rules failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

/** Upsert: body carries `id` to update an existing rule, omits it to create. */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' && body.id ? body.id : undefined;
  const parsed = approvalRuleSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await approvalService.upsertRule(session, parsed.data, id);
    return Response.json(apiOk(data), { status: id ? 200 : 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/approvals/rules failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
