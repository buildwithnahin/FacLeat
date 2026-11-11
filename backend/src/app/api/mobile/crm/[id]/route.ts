import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { customerService } from '@/server/services/customer.service';
import { customerUpdateSchema } from '@/server/validators/crm';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Customer detail plus outstanding-balance aggregate in one call — mirrors
 * src/app/(app)/crm/[id]/page.tsx, which looked up the customer then joined
 * it against customerService.outstandingByCustomer(branchId) client-side.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const customer = await customerService.getById(session, id);
    const outstanding = await customerService.outstandingByCustomer(session, customer.branchId);
    const agg = outstanding.find((r) => r.customerId === customer.id);
    return Response.json(
      apiOk({
        customer,
        totalSales: agg?.totalSales ?? null,
        totalDue: agg?.totalDue ?? null,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/crm/${id} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = customerUpdateSchema.safeParse({ ...body, id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const customer = await customerService.update(session, parsed.data);
    return Response.json(apiOk(customer));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`PATCH /api/mobile/crm/${id} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
