import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { wholesaleService } from '@/server/services/wholesale.service';
import { recordPaymentSchema } from '@/server/validators/wholesale';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = recordPaymentSchema.safeParse({ ...(body ?? {}), invoiceId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const payment = await wholesaleService.recordPayment(session, parsed.data);
    return Response.json(apiOk(payment));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/wholesale/invoices/${id}/payments failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
