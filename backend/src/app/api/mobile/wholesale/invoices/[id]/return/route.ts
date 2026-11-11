import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { wholesaleService } from '@/server/services/wholesale.service';
import { returnInvoiceSchema } from '@/server/validators/wholesale';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = returnInvoiceSchema.safeParse({ ...(body ?? {}), invoiceId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const ret = await wholesaleService.returnInvoice(session, parsed.data);
    return Response.json(apiOk(ret));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/wholesale/invoices/${id}/return failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
