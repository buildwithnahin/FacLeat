import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { purchaseService } from '@/server/services/purchase.service';
import { invoiceCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const supplierId = req.nextUrl.searchParams.get('supplierId') ?? undefined;
  const statusIn = req.nextUrl.searchParams.get('statusIn');

  try {
    // `statusIn` (comma-separated) filters post-fetch — see orders/route.ts
    // for why this stays out of the service's filter signature.
    const data = await purchaseService.listInvoices(session, { supplierId });
    const filtered = statusIn
      ? data.filter((inv) => statusIn.split(',').includes(inv.status))
      : data;
    return Response.json(apiOk(filtered));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/purchase/invoices failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = invoiceCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await purchaseService.createInvoice(session, parsed.data);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/purchase/invoices failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
