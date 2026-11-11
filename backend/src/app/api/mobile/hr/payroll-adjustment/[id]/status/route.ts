import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { PayrollAdjustmentService } from '@/server/services/payroll-adjustment.service';
import { payrollAdjustmentApprovalSchema } from '@/server/validators/payroll-adjustment';
import type { PayrollAdjustmentStatus } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = payrollAdjustmentApprovalSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const updated = await PayrollAdjustmentService.updateStatus(
      session,
      id,
      parsed.data.status as PayrollAdjustmentStatus,
      parsed.data.remarks,
    );
    return Response.json(apiOk(updated));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/payroll-adjustment/[id]/status failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
