import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { PayrollAdjustmentService } from '@/server/services/payroll-adjustment.service';
import { payrollAdjustmentFormSchema } from '@/server/validators/payroll-adjustment';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const type = sp.get('type');
    const q = sp.get('q');

    const where: Prisma.PayrollAdjustmentWhereInput = {};
    if (status) where.status = status as Prisma.PayrollAdjustmentWhereInput['status'];
    if (type) where.type = type as Prisma.PayrollAdjustmentWhereInput['type'];
    if (q) {
      where.OR = [
        { employee: { firstName: { contains: q } } },
        { employee: { code: { contains: q } } },
        { no: { contains: q } },
      ];
    }

    const adjustments = await PayrollAdjustmentService.getAdjustments(session, where);
    return Response.json(apiOk(adjustments));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payroll-adjustment failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = payrollAdjustmentFormSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const created = await PayrollAdjustmentService.createAdjustment(session, parsed.data);
    return Response.json(apiOk(created));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/payroll-adjustment failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
