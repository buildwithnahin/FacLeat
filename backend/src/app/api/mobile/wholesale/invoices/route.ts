import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { wholesaleService } from '@/server/services/wholesale.service';
import { createInvoiceSchema } from '@/server/validators/wholesale';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const invoices = await wholesaleService.listInvoices(session, {
      status: sp.get('status') ?? undefined,
      search: sp.get('search') ?? undefined,
      branchId:
        sp.get('branchId') ??
        session.activeBranchId ??
        session.defaultBranchId ??
        session.allowedBranchIds?.[0] ??
        undefined,
      customerId: sp.get('customerId') ?? undefined,
    });
    return Response.json(apiOk(invoices));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/wholesale/invoices failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const invoice = await wholesaleService.createInvoice(session, parsed.data);
    return Response.json(apiOk(invoice));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/wholesale/invoices failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
