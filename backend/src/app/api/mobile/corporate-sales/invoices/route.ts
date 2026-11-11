import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { corporateService } from '@/server/services/corporate-sales.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  try {
    const invoices = await corporateService.listInvoices(session, {
      status: sp.get('status') ?? undefined,
      search: sp.get('search') ?? undefined,
      branchId:
        sp.get('branchId') ??
        session.activeBranchId ??
        session.defaultBranchId ??
        session.allowedBranchIds?.[0] ??
        undefined,
    });
    return Response.json(apiOk(invoices));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/corporate-sales/invoices failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
