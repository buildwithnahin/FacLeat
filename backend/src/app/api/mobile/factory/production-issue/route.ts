import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { productionIssueCreateSchema } from '@/server/validators/factory';

/** WIP Production Issue page (web `/factory/production-issue`). */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const branchId = session.activeBranchId ?? undefined;
    const includeCompleted = req.nextUrl.searchParams.get('includeCompleted') === 'true';

    const [orders, warehouses, issues] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { branchId: branchId || undefined, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }, { id: 'desc' }],
        include: {
          product: { select: { id: true, name: true, sku: true } },
          materials: { include: { product: { select: { id: true, name: true, sku: true } } } },
          productionIssueVouchers: { select: { id: true, status: true, voucherNo: true } },
        },
      }),
      prisma.warehouse.findMany({
        where: { branchId: branchId || undefined, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, type: true },
      }),
      factoryWorkflowService.listProductionIssues(session, branchId),
    ]);

    const mappedOrders = orders.map((order) => {
      const hasIssuedVoucher = order.productionIssueVouchers.some((v) => v.status === 'ISSUED');
      const allMaterialsConsumed =
        order.materials.length > 0 &&
        order.materials.every((m) => Number(m.consumedQty) >= Number(m.plannedQty));

      const isIssueCompleted =
        hasIssuedVoucher || allMaterialsConsumed || order.status === 'COMPLETED';

      return {
        ...order,
        isIssueCompleted,
        hasIssuedVoucher,
        allMaterialsConsumed,
      };
    });

    const returnedOrders = includeCompleted
      ? mappedOrders
      : mappedOrders.filter((o) => !o.isIssueCompleted);

    return Response.json(
      apiOk({
        orders: returnedOrders,
        allOrders: mappedOrders,
        warehouses,
        issues,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/production-issue failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = productionIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const voucher = await factoryWorkflowService.createProductionIssue(session, parsed.data);
    return Response.json(apiOk(voucher), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/factory/production-issue failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
