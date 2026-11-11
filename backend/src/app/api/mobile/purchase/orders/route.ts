import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { purchaseService } from '@/server/services/purchase.service';
import { poCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  const statusIn = req.nextUrl.searchParams.get('statusIn');
  const supplierId = req.nextUrl.searchParams.get('supplierId') ?? undefined;
  const search = req.nextUrl.searchParams.get('search') ?? req.nextUrl.searchParams.get('q') ?? undefined;
  const branchId =
    req.nextUrl.searchParams.get('branchId') ??
    session.activeBranchId ??
    session.defaultBranchId ??
    session.allowedBranchIds?.[0] ??
    undefined;

  try {
    // `statusIn` (comma-separated) is an API-layer convenience for pickers
    // that need "any open PO" — filtered here rather than in the service so
    // `listPurchaseOrders`'s single-status filter signature stays untouched.
    const data = await purchaseService.listPurchaseOrders(session, {
      status,
      supplierId,
      branchId,
      search,
    });
    const filtered = statusIn
      ? data.filter((po) => statusIn.split(',').includes(po.status))
      : data;
    return Response.json(apiOk(filtered));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/purchase/orders failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = poCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(
      apiError(parsed.error.issues[0]?.message ?? 'Validation failed', parsed.error.flatten()),
      { status: 422 },
    );
  }

  try {
    const data = await purchaseService.createPurchaseOrder(session, parsed.data);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/purchase/orders failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
