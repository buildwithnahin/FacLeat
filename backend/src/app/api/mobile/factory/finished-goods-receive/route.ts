import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { finishedGoodsReceiveCreateSchema } from '@/server/validators/factory';

/** Finished Goods Receive page (web `/factory/finished-goods-receive`). */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const branchId = session.activeBranchId ?? undefined;
    const includeCompleted = req.nextUrl.searchParams.get('includeCompleted') === 'true';

    const [orders, warehouses, vouchers] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { branchId: branchId || undefined, status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
        orderBy: [{ createdAt: 'desc' }, { number: 'desc' }, { id: 'desc' }],
        include: {
          product: { select: { id: true, name: true, sku: true } },
          stages: { orderBy: { sequence: 'asc' } },
          finishedGoodsReceiveVouchers: {
            include: { items: true },
          },
        },
      }),
      prisma.warehouse.findMany({
        where: {
          branchId: branchId || undefined,
          isActive: true,
          type: { in: ['MAIN', 'STORE', 'SHOWROOM'] },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      factoryWorkflowService.listFinishedGoodsReceives(session, branchId),
    ]);

    const mappedOrders = orders.map((order) => {
      const totalReceived = order.finishedGoodsReceiveVouchers.reduce(
        (acc, v) => acc + v.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
        0,
      );
      const isReceivedFull = totalReceived >= Number(order.plannedQty);
      const isProducedFull = Number(order.producedQty) >= Number(order.plannedQty);

      const isCompleted = order.status === 'COMPLETED' || isReceivedFull || isProducedFull;

      return {
        ...order,
        isCompleted,
        totalReceived,
      };
    });

    const returnedOrders = includeCompleted
      ? mappedOrders
      : mappedOrders.filter((o) => !o.isCompleted);

    return Response.json(
      apiOk({
        orders: returnedOrders,
        allOrders: mappedOrders,
        warehouses,
        vouchers,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/finished-goods-receive failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = finishedGoodsReceiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const voucher = await factoryWorkflowService.createFinishedGoodsReceive(session, parsed.data);
    return Response.json(apiOk(voucher), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/factory/finished-goods-receive failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
