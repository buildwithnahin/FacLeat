import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { leavesService } from '@/server/services/leaves.service';
import { resolveLeavePolicyForEmployee } from '@/server/services/leave-policies.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get('employeeId');
  const year = Number(sp.get('year') ?? new Date().getUTCFullYear());
  if (!employeeId) {
    return Response.json(apiError('Validation failed', 'employeeId is required'), { status: 422 });
  }

  try {
    const [policy, balance] = await Promise.all([
      resolveLeavePolicyForEmployee(employeeId, new Date(Date.UTC(year, 0, 1))),
      leavesService.getLeaveBalance(session, employeeId, year),
    ]);
    return Response.json(apiOk({ policy, balance }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leaves/policy-preview failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
