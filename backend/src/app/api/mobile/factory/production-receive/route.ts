import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { productionReceiveCreateSchema } from '@/server/validators/factory';

/** WIP / Production Receive page (web `/factory/production-receive`). */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const branchId = session.activeBranchId ?? undefined;
    const includeCompleted = req.nextUrl.searchParams.get('includeCompleted') === 'true';

    const [orders, employees, receives] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { branchId: branchId || undefined, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }, { id: 'desc' }],
        include: {
          product: { select: { id: true, name: true, sku: true } },
          stages: { orderBy: { sequence: 'asc' } },
        },
      }),
      prisma.employee.findMany({
        where: { branchId: branchId || undefined, status: 'ACTIVE' },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, firstName: true, lastName: true },
      }),
      factoryWorkflowService.listProductionReceives(session, branchId),
    ]);

    const mappedOrders = orders.map((order) => {
      const allStagesDone =
        order.stages.length > 0 &&
        order.stages.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED');
      const isProduced = Number(order.producedQty) >= Number(order.plannedQty);
      const isCompleted = order.status === 'COMPLETED' || isProduced || allStagesDone;

      return {
        ...order,
        isCompleted,
        allStagesDone,
      };
    });

    const returnedOrders = includeCompleted
      ? mappedOrders
      : mappedOrders.filter((o) => !o.isCompleted);

    return Response.json(
      apiOk({
        orders: returnedOrders,
        allOrders: mappedOrders,
        employees,
        receives,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/production-receive failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = productionReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const voucherNo = await factoryWorkflowService.createProductionReceive(session, parsed.data);
    return Response.json(apiOk({ voucherNo }), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/factory/production-receive failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
