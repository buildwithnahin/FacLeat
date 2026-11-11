import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { PayrollRunService } from '@/server/services/payroll-run.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const run = await PayrollRunService.closePayroll(session, id);
    return Response.json(apiOk(run));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/payroll-run/[id]/close failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
