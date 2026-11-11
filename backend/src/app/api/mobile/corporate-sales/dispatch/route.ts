import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

/**
 * Backs the "Finished Goods Dispatch" console at web/'s `warehouse/dispatch`
 * page — deliverable corporate orders (CONFIRMED/PARTIALLY_DELIVERED with
 * remaining quantity) plus recent deliveries, ported verbatim from that
 * page's original direct-Prisma query. Lives under corporate-sales/ since
 * it queries CorporateOrder/CorporateDelivery and is gated by
 * corporate-sales:deliver, even though the page itself sits at a
 * warehouse/ URL for the FG-dispatch workflow.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'corporate-sales:deliver');
    const branchId = session.activeBranchId ?? undefined;

    const [orders, deliveries] = await Promise.all([
      prisma.corporateOrder.findMany({
        where: {
          branchId: branchId || undefined,
          status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED'] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, address: true } },
          warehouse: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      }),
      prisma.corporateDelivery.findMany({
        where: { branchId: branchId || undefined, status: { not: 'VOIDED' } },
        orderBy: { createdAt: 'desc' },
        include: {
          order: { include: { customer: { select: { name: true } } } },
          warehouse: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
        take: 25,
      }),
    ]);

    const deliverableOrders = orders
      .map((order) => ({
        id: order.id,
        number: order.number,
        customerName: order.customer.name,
        warehouseId: order.warehouse.id,
        warehouseName: order.warehouse.name,
        deliveryAddress: order.customer.address ?? '',
        items: order.items
          .map((item) => {
            const orderedQty = Number(item.quantity);
            const remainingQty = Number(item.quantity.minus(item.deliveredQty));
            return {
              id: item.id,
              productName: item.product.name,
              sku: item.product.sku,
              orderedQty,
              remainingQty,
            };
          })
          .filter((item) => item.remainingQty > 0),
      }))
      .filter((order) => order.items.length > 0);

    return Response.json(
      apiOk({
        orders: deliverableOrders,
        deliveries: deliveries.map((delivery) => ({
          id: delivery.id,
          number: delivery.number,
          status: delivery.status,
          orderNumber: delivery.order.number,
          customerName: delivery.order.customer.name,
          warehouseName: delivery.warehouse.name,
          expectedDate: delivery.expectedDate ? delivery.expectedDate.toISOString().slice(0, 10) : '',
          trackingNo: delivery.trackingNo ?? '',
          gatePassNo: delivery.gatePassNo ?? '',
          transportCompany: delivery.transportCompany ?? '',
          vehicleNo: delivery.vehicleNo ?? '',
          driverName: delivery.driverName ?? '',
          driverPhone: delivery.driverPhone ?? '',
          notes: delivery.notes ?? '',
          createdAt: delivery.createdAt.toISOString().slice(0, 10),
          items: delivery.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            sku: item.product.sku,
            quantity: item.quantity.toString(),
          })),
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/corporate-sales/dispatch failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
