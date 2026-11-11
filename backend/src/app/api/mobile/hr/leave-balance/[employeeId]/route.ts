import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { leaveBalanceService } from '@/server/services/leave-balance.service';
import { leaveTypesService } from '@/server/services/leave-types.service';

type RouteParams = { params: Promise<{ employeeId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { employeeId } = await params;
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get('year') || new Date().getUTCFullYear());

  try {
    const [detail, leaveTypes] = await Promise.all([
      leaveBalanceService.getEmployeeBalanceDetail(session, employeeId, year),
      leaveTypesService.listActive(session),
    ]);
    return Response.json(apiOk({ detail, leaveTypes, adjustmentTypes: leaveBalanceService.adjustmentTypes }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leave-balance/[employeeId] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
