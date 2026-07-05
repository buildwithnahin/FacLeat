import { PageHeader } from '@/components/shared/page-header';
import { authorize } from '@/server/auth/authorize';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { DispatchConsole } from './dispatch-console';

export const metadata = { title: 'Warehouse Dispatch' };

export default async function WarehouseDispatchPage() {
  const session = await getSession();
  await authorize(session, 'corporate-sales:deliver');
  const branchId = session?.activeBranchId;

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
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
    }),
    prisma.corporateDelivery.findMany({
      where: {
        branchId: branchId || undefined,
        status: { not: 'VOIDED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            customer: { select: { name: true } },
          },
        },
        warehouse: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finished Goods Dispatch"
        description="Create dispatch challans, move them through picking and delivery, and keep the FG warehouse workflow visible in one place."
      />

      <DispatchConsole
        orders={deliverableOrders}
        deliveries={deliveries.map((delivery) => ({
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
        }))}
      />
    </div>
  );
}
