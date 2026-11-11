import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

// Picker data for "Calculate Payroll": all branches plus payroll periods
// still OPEN (a run can only be calculated against an open period).
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const [branches, payrollPeriods] = await Promise.all([
      prisma.branch.findMany({ orderBy: { name: 'asc' } }),
      prisma.payrollPeriod.findMany({
        where: { status: { in: ['OPEN'] } },
        orderBy: [{ startDate: 'desc' }],
      }),
    ]);
    return Response.json(apiOk({ branches, payrollPeriods }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payroll-run/form-data failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}
