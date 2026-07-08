import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { ecommerceService } from '@/server/services/ecommerce.service';
import { warehouseService } from '@/server/services/warehouse.service';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import { NotFoundError } from '@/lib/errors';
import { OrderActions } from './order-actions';

export const metadata = { title: 'Online order' };

const STATUS_TONE: Record<string, PillTone> = {
  SYNCED: 'blue',
  PACKING: 'amber',
  PACKED: 'amber',
  SHIPPED: 'green',
  DELIVERED: 'green',
  CANCELLED: 'red',
  PARTIALLY_RETURNED: 'orange',
  RETURNED: 'red',
};

export default async function EcommerceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  let order;
  try {
    order = await ecommerceService.getOrder(session, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const currency = order.currency as CurrencyCode;
  const warehouses = await warehouseService.listActiveForBranch(session, order.branchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.number}`}
        description={`${order.channel.name} · ${order.customerName ?? 'Guest'}`}
      >
        <Button variant="outline" asChild>
          <Link href="/ecommerce/orders">
            <ArrowLeft className="h-4 w-4" /> All orders
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Pill tone={STATUS_TONE[order.status] ?? 'grey'}>
                  {order.status.toLowerCase().replace(/_/g, ' ')}
                </Pill>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Order date</div>
                <div className="tabular">{order.orderDate.toISOString().slice(0, 10)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Channel</div>
                <div>{order.channel.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Warehouse</div>
                <div>{order.warehouse?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Payment status</div>
                <div>{order.paymentStatus.toLowerCase().replace(/_/g, ' ')}</div>
              </div>
              {order.courier && (
                <div>
                  <div className="text-xs text-muted-foreground">Courier</div>
                  <div>
                    {order.courier} {order.trackingNo ? `· ${order.trackingNo}` : ''}
                  </div>
                </div>
              )}
            </div>
            {order.shipToAddress && (
              <div className="text-sm border-t pt-3 text-muted-foreground mt-4">
                Ship to: {order.shipToAddress}
              </div>
            )}
            {order.notes && (
              <div className="text-sm border-t pt-3 text-muted-foreground mt-4">{order.notes}</div>
            )}
          </Card>

          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium">Line items</div>
            <DataTable
              rows={order.items}
              rowKey={(r) => r.id}
              empty="—"
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  cell: (r) => (
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.sku}</div>
                    </div>
                  ),
                },
                { key: 'qty', header: 'Ordered', align: 'right', cell: (r) => <span className="tabular">{r.quantity.toString()}</span> },
                { key: 'packed', header: 'Packed', align: 'right', cell: (r) => <span className="tabular">{r.packedQty.toString()}</span> },
                { key: 'fulfilled', header: 'Fulfilled', align: 'right', cell: (r) => <span className="tabular">{r.fulfilledQty.toString()}</span> },
                { key: 'returned', header: 'Returned', align: 'right', cell: (r) => <span className="tabular">{r.returnedQty.toString()}</span> },
                { key: 'price', header: 'Price', align: 'right', cell: (r) => <span className="tabular">{formatCurrency(r.unitPrice, currency)}</span> },
                { key: 'total', header: 'Line total', align: 'right', cell: (r) => <span className="tabular font-medium">{formatCurrency(r.lineTotal, currency)}</span> },
              ]}
            />
            <div className="border-t p-4 grid grid-cols-2 gap-3 text-sm max-w-sm ml-auto">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="text-right tabular">{formatCurrency(order.subtotal, currency)}</div>
              <div className="text-muted-foreground">Discount</div>
              <div className="text-right tabular">−{formatCurrency(order.discountTotal, currency)}</div>
              <div className="text-muted-foreground">Shipping</div>
              <div className="text-right tabular">{formatCurrency(order.shippingTotal, currency)}</div>
              <div className="text-muted-foreground">Tax</div>
              <div className="text-right tabular">{formatCurrency(order.taxTotal, currency)}</div>
              <div className="font-semibold border-t pt-2">Grand total</div>
              <div className="text-right font-semibold tabular border-t pt-2">
                {formatCurrency(order.grandTotal, currency)}
              </div>
            </div>
          </Card>

          {order.fulfillments.length > 0 && (
            <Card className="p-0">
              <div className="px-4 py-3 border-b text-sm font-medium">
                Fulfillments ({order.fulfillments.length})
              </div>
              <DataTable
                rows={order.fulfillments}
                rowKey={(r) => r.id}
                empty="—"
                columns={[
                  { key: 'status', header: 'Status', cell: (r) => <span className="text-xs">{r.status.toLowerCase()}</span> },
                  {
                    key: 'shipped',
                    header: 'Shipped',
                    cell: (r) => (r.shippedAt ? <span className="tabular">{r.shippedAt.toISOString().slice(0, 10)}</span> : '—'),
                  },
                  {
                    key: 'delivered',
                    header: 'Delivered',
                    cell: (r) => (r.deliveredAt ? <span className="tabular">{r.deliveredAt.toISOString().slice(0, 10)}</span> : '—'),
                  },
                  { key: 'tracking', header: 'Tracking', cell: (r) => r.trackingNo ?? '—' },
                  { key: 'courier', header: 'Courier', cell: (r) => r.courier ?? '—' },
                  { key: 'items', header: 'Items', align: 'right', cell: (r) => <span className="tabular">{r.items.length}</span> },
                ]}
              />
            </Card>
          )}

          {order.payments.length > 0 && (
            <Card className="p-0">
              <div className="px-4 py-3 border-b text-sm font-medium">
                Payments ({order.payments.length})
              </div>
              <DataTable
                rows={order.payments}
                rowKey={(r) => r.id}
                empty="—"
                columns={[
                  { key: 'date', header: 'Date', cell: (r) => <span className="tabular">{r.receivedAt.toISOString().slice(0, 10)}</span> },
                  { key: 'method', header: 'Method', cell: (r) => r.method.replace(/_/g, ' ').toLowerCase() },
                  { key: 'provider', header: 'Provider', cell: (r) => r.provider ?? '—' },
                  { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="tabular font-medium">{formatCurrency(r.amount, currency)}</span> },
                  { key: 'status', header: 'Status', cell: (r) => <span className="text-xs">{r.status.toLowerCase()}</span> },
                ]}
              />
            </Card>
          )}

          {order.returns.length > 0 && (
            <Card className="p-0">
              <div className="px-4 py-3 border-b text-sm font-medium">
                Returns ({order.returns.length})
              </div>
              <DataTable
                rows={order.returns}
                rowKey={(r) => r.id}
                empty="—"
                columns={[
                  { key: 'date', header: 'Received', cell: (r) => <span className="tabular">{r.receivedAt.toISOString().slice(0, 10)}</span> },
                  { key: 'refund', header: 'Refund', align: 'right', cell: (r) => <span className="tabular">{formatCurrency(r.refundAmount, currency)}</span> },
                  { key: 'method', header: 'Method', cell: (r) => r.refundMethod.replace(/_/g, ' ').toLowerCase() },
                  { key: 'reason', header: 'Reason', cell: (r) => r.reason ?? '—' },
                  { key: 'status', header: 'Status', cell: (r) => <span className="text-xs">{r.status.toLowerCase()}</span> },
                ]}
              />
            </Card>
          )}
        </div>

        <div>
          <OrderActions
            orderId={order.id}
            status={order.status}
            defaultWarehouseId={order.warehouse?.id ?? ''}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
            currency={currency}
            items={order.items.map((i) => ({
              id: i.id,
              name: i.name,
              sku: i.sku,
              quantity: Number(i.quantity),
              fulfilledQty: Number(i.fulfilledQty),
              returnedQty: Number(i.returnedQty),
              unitPrice: Number(i.unitPrice),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
