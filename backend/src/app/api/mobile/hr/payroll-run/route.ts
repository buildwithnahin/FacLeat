import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { PayrollRunService } from '@/server/services/payroll-run.service';
import { calculatePayrollSchema } from '@/server/validators/payroll-run';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const q = sp.get('q');

    const where: Prisma.PayrollRunWhereInput = {};
    if (status) where.status = status as Prisma.PayrollRunWhereInput['status'];
    if (q) {
      where.OR = [
        { period: { contains: q } },
        { branch: { name: { contains: q } } },
      ];
    }

    const runs = await PayrollRunService.getPayrollRuns(session, where);
    return Response.json(apiOk(runs));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payroll-run failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = calculatePayrollSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const run = await PayrollRunService.calculatePayroll(session, parsed.data);
    return Response.json(apiOk(run));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/payroll-run failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
