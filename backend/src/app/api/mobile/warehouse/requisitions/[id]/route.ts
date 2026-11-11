import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';
import { stockRequisitionService } from '@/server/services/stock-requisition.service';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Bundles the "assignable warehouses" picklist (every active warehouse
 * except the requisition's own showroom) alongside the requisition — the
 * root detail page fetched that with a direct Prisma call.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const requisition = await stockRequisitionService.getRequisition(session, id);

    const otherWarehouses = await prisma.warehouse.findMany({
      where: { isActive: true, id: { not: requisition.showroomWarehouseId } },
      orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
      include: { branch: { select: { name: true } } },
    });

    return Response.json(
      apiOk({
        id: requisition.id,
        number: requisition.number,
        status: requisition.status,
        priority: requisition.priority,
        remarks: requisition.remarks,
        requiredDate: requisition.requiredDate.toISOString(),
        showroomWarehouseId: requisition.showroomWarehouseId,
        showroomWarehouse: requisition.showroomWarehouse,
        sourceWarehouseId: requisition.sourceWarehouseId,
        sourceWarehouse: requisition.sourceWarehouse,
        items: requisition.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          product: { name: item.product.name, sku: item.product.sku },
          requestedQty: item.requestedQty.toString(),
          approvedQty: item.approvedQty.toString(),
          dispatchedQty: item.dispatchedQty.toString(),
          receivedQty: item.receivedQty.toString(),
        })),
        transfers: requisition.transfers.map((transfer) => ({
          id: transfer.id,
          number: transfer.number,
          status: transfer.status,
          toBranchId: transfer.toBranchId,
          fromWarehouse: transfer.fromWarehouse,
          toWarehouse: transfer.toWarehouse,
          items: transfer.items.map((item) => ({
            id: item.id,
            product: { name: item.product.name, sku: item.product.sku },
            quantity: item.quantity.toString(),
            receivedQty: item.receivedQty.toString(),
            damagedQty: item.damagedQty.toString(),
            missingQty: item.missingQty.toString(),
          })),
        })),
        otherWarehouses: otherWarehouses.map((warehouse) => ({
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
          branchName: warehouse.branch.name,
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/requisitions/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
