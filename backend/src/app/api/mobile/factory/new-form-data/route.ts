import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

/**
 * Lookup data for the "New production order" form (web `/factory/new`):
 * active branches, active products, active warehouses, and — when a
 * `planId` query param is present — the plan to prefill from. Mirrors the
 * root `new/page.tsx` prisma calls verbatim.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const planId = req.nextUrl.searchParams.get('planId');

    const [branches, products, warehouses, plan] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, sku: true, name: true, unit: true, type: true },
      }),
      prisma.warehouse.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true, branchId: true },
      }),
      planId ? prisma.productionPlan.findUnique({ where: { id: planId } }) : Promise.resolve(null),
    ]);

    const prefill =
      plan && (plan.status === 'APPROVED' || plan.status === 'SCHEDULED')
        ? {
            planId: plan.id,
            planNo: plan.planNo,
            branchId: plan.branchId,
            productId: plan.productId,
            plannedQty: plan.quantity.toString(),
            plannedStartDate: plan.plannedStartDate.toISOString().slice(0, 10),
            plannedEndDate: plan.plannedEndDate.toISOString().slice(0, 10),
          }
        : null;

    return Response.json(apiOk({ branches, products, warehouses, prefill }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/new-form-data failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
