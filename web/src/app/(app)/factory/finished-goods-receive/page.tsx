import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { backendFetch } from '@/lib/backend-client';
import { FinishedGoodsReceiveForm } from './finished-goods-receive-form';
import { UNITS } from '@/server/validators/factory';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Finished Goods Receive' };

interface Stage {
  id: string;
  sequence: number;
  name: string;
}

interface Order {
  id: string;
  number: string;
  productId: string;
  unit: string;
  product: { id: string; name: string; sku: string };
  stages: Stage[];
  isCompleted?: boolean;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface VoucherItem {
  id: string;
  quantity: string;
  uom: string;
  qualityStatus: string;
  product: { id: string; name: string; sku: string };
}

interface Voucher {
  id: string;
  receiveNo: string;
  date: string;
  createdAt?: string;
  order: { id: string; number: string; product: { name: string; sku: string } };
  warehouse: { id: string; name: string };
  items: VoucherItem[];
}

export default async function FinishedGoodsReceivePage() {
  const { orders, warehouses, vouchers } = await backendFetch<{
    orders: Order[];
    allOrders?: Order[];
    warehouses: Warehouse[];
    vouchers: Voucher[];
  }>('/api/mobile/factory/finished-goods-receive?includeCompleted=true');

  const sortedVouchers = [...vouchers].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.receiveNo.localeCompare(a.receiveNo, undefined, { numeric: true });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finished Goods Receive"
        description="Receive completed finished goods into FG warehouse and reduce WIP balance."
      />

      <FinishedGoodsReceiveForm
        orders={orders.map((order) => ({
          id: order.id,
          label: `${order.number} — ${order.product.name} (${order.product.sku})`,
          productId: order.productId,
          unit: order.unit as (typeof UNITS)[number],
          isCompleted: Boolean(order.isCompleted),
          stages: order.stages.map((stage) => ({
            id: stage.id,
            label: `${stage.sequence}. ${stage.name}`,
          })),
        }))}
        warehouses={warehouses.map((warehouse) => ({
          id: warehouse.id,
          label: `${warehouse.name} (${warehouse.code})`,
        }))}
      />

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">FG Receive Vouchers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">FG Receive No</th>
                <th className="px-4 py-3 text-left">Production Order</th>
                <th className="px-4 py-3 text-left">FG Warehouse</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Items</th>
              </tr>
            </thead>
            <tbody>
              {sortedVouchers.map((voucher) => (
                <tr key={voucher.id} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{voucher.receiveNo}</td>
                  <td className="px-4 py-3">
                    <div>{voucher.order.number}</div>
                    <div className="text-xs text-muted-foreground">{voucher.order.product.name}</div>
                  </td>
                  <td className="px-4 py-3">{voucher.warehouse.name}</td>
                  <td className="px-4 py-3">{new Date(voucher.date).toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {voucher.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          {item.product.name} • {item.quantity.toString()} {item.uom} • {item.qualityStatus}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No finished goods receive vouchers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
