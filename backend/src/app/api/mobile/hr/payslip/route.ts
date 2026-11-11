import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { PayslipService } from '@/server/services/payslip.service';

// PayslipService's static methods don't call authorize() internally (a
// pre-existing gap in the copied service, not something to fix here) — gate
// with the same 'hr:read' check every other HR list route enforces.
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const paymentStatus = sp.get('paymentStatus');
    const q = sp.get('q');

    const where: Prisma.PayslipWhereInput = {};
    if (status) where.status = status as Prisma.PayslipWhereInput['status'];
    if (paymentStatus) where.paymentStatus = paymentStatus as Prisma.PayslipWhereInput['paymentStatus'];
    if (q) {
      where.OR = [
        { employee: { firstName: { contains: q } } },
        { employee: { code: { contains: q } } },
        { no: { contains: q } },
      ];
    }

    const payslips = await PayslipService.getPayslips(where);
    return Response.json(apiOk(payslips));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/payslip failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}
