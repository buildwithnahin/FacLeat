import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { supplierService } from '@/server/services/supplier.service';
import { supplierUpdateSchema } from '@/server/validators/suppliers';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    const supplier = await supplierService.getById(session, id);
    // Same aggregation `list()` uses, scoped to this supplier's branch, so
    // the detail page's KPI cards (Total Purchases / Outstanding Due) match
    // what the list page shows for this row.
    const outstanding = await supplierService.outstandingBySupplier(session, supplier.branchId);
    const agg = outstanding.find((row) => row.supplierId === supplier.id);
    return Response.json(
      apiOk({
        ...supplier,
        totalPurchase: agg?.totalPurchase ?? null,
        dueAmount: agg?.totalDue ?? null,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/suppliers/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = supplierUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await supplierService.update(session, parsed.data);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PATCH /api/mobile/suppliers/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    await supplierService.remove(session, id);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('DELETE /api/mobile/suppliers/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
