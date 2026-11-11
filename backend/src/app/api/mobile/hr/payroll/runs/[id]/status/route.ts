import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';

type RouteParams = { params: Promise<{ id: string }> };

// Mirrors the old `payrollStatusAction` Server Action's action switch — kept
// as a single endpoint (not four) since the web action just forwards
// whichever button the operator clicked.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    if (action === 'approve') await hrService.approvePayroll(session, id);
    else if (action === 'pay') await hrService.markPayrollPaid(session, id);
    else if (action === 'lock') await hrService.lockPayroll(session, id);
    else if (action === 'cancel') await hrService.cancelPayroll(session, id);
    else return Response.json(apiError('Unknown action'), { status: 422 });

    return Response.json(apiOk({ id, action }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/payroll/runs/[id]/status failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
