import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { PayrollPeriodsService } from '@/server/services/payroll-periods.service';
import { payrollPeriodFormSchema } from '@/server/validators/payroll-periods';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const period = await PayrollPeriodsService.getPayrollPeriodById(session, id);
    return Response.json(apiOk(period));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payroll-period/[id] failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = payrollPeriodFormSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const period = await PayrollPeriodsService.updatePayrollPeriod(session, id, parsed.data);
    return Response.json(apiOk(period));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PATCH /api/mobile/hr/payroll-period/[id] failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
