import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { leavesService } from '@/server/services/leaves.service';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map((id: unknown) => String(id)) : [];
  const stage = body?.stage;
  const action = body?.action;
  if (ids.length === 0 || (stage !== 'manager' && stage !== 'hr')) {
    return Response.json(apiError('Validation failed', 'ids and stage are required'), { status: 422 });
  }
  if (!['approve', 'reject', 'return', 'cancel'].includes(action)) {
    return Response.json(apiError('Validation failed', 'invalid action'), { status: 422 });
  }

  try {
    const data = await leavesService.bulkDecide(session, {
      ids,
      stage,
      action,
      remarks: body?.remarks ?? null,
    });
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/leaves/bulk-decide failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
