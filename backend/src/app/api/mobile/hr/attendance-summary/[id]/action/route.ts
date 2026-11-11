import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { attendanceSummaryService } from '@/server/services/attendance-summary.service';
import { attendanceSummaryActionSchema } from '@/server/validators/attendance-summary';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = attendanceSummaryActionSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    await attendanceSummaryService.handleSingleAction(session, parsed.data);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/attendance-summary/[id]/action failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
