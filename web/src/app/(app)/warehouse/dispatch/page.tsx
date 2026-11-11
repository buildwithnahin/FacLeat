import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { DispatchConsole } from './dispatch-console';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Warehouse Dispatch' };

interface DispatchOrderItem {
  id: string;
  productName: string;
  sku: string;
  orderedQty: number;
  remainingQty: number;
}

interface DispatchOrder {
  id: string;
  number: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  deliveryAddress: string;
  items: DispatchOrderItem[];
}

interface DispatchDeliveryItem {
  id: string;
  productName: string;
  sku: string;
  quantity: string;
}

interface DispatchDelivery {
  id: string;
  number: string;
  status: string;
  orderNumber: string;
  customerName: string;
  warehouseName: string;
  expectedDate: string;
  trackingNo: string;
  gatePassNo: string;
  transportCompany: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  notes: string;
  createdAt: string;
  items: DispatchDeliveryItem[];
}

export default async function WarehouseDispatchPage() {
  const { orders, deliveries } = await backendFetch<{ orders: DispatchOrder[]; deliveries: DispatchDelivery[] }>(
    '/api/mobile/corporate-sales/dispatch',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finished Goods Dispatch"
        description="Create dispatch challans, move them through picking and delivery, and keep the FG warehouse workflow visible in one place."
      />

      <DispatchConsole orders={orders} deliveries={deliveries} />
    </div>
  );
}
