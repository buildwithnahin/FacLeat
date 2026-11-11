import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { leaveBalanceService } from '@/server/services/leave-balance.service';
import { leaveBalanceAdjustmentSchema } from '@/server/validators/leave-balance';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = leaveBalanceAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await leaveBalanceService.createAdjustment(session, parsed.data);
    return Response.json(apiOk(data), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/leave-balance/adjustments failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
