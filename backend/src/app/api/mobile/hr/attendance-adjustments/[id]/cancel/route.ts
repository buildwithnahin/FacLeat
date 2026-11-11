import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { attendanceAdjustmentsService } from '@/server/services/attendance-adjustments.service';
import { attendanceAdjustmentCancelSchema } from '@/server/validators/attendance-adjustments';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  const parsed = attendanceAdjustmentCancelSchema.safeParse({ id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    await attendanceAdjustmentsService.cancel(session, parsed.data);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/attendance-adjustments/[id]/cancel failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
