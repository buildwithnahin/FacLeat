import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

// Picker data for the create/edit adjustment form — active employees plus
// payroll periods still OPEN (a closed/draft period can't take new manual
// adjustments, mirrors the same restriction the service enforces on write).
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const [employees, payrollPeriods] = await Promise.all([
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, code: true },
        orderBy: [{ firstName: 'asc' }],
      }),
      prisma.payrollPeriod.findMany({
        where: { status: { in: ['OPEN'] } },
        orderBy: [{ startDate: 'desc' }],
      }),
    ]);
    return Response.json(apiOk({ employees, payrollPeriods }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payroll-adjustment/form-data failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}
