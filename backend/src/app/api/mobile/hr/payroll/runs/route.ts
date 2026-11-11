import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { payrollRunCreateSchema } from '@/server/validators/hr';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
    const runs = await hrService.listPayrollRuns(session, { branchId });
    return Response.json(apiOk(runs));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payroll/runs failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = payrollRunCreateSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const run = await hrService.createPayrollRun(session, parsed.data);
    return Response.json(apiOk(run));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/payroll/runs failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
