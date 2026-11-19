import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import { OrderActions } from './order-actions';
import { OrderPackingSlip } from './order-packing-slip';

export const dynamic = 'force-dynamic';

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

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: string;
  packedQty: string;
  fulfilledQty: string;
  returnedQty: string;
  unitPrice: string;
  lineTotal: string;
}

interface Fulfillment {
  id: string;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNo: string | null;
  courier: string | null;
  items: unknown[];
}

interface OrderPayment {
  id: string;
  receivedAt: string;
  method: string;
  provider: string | null;
  amount: string;
  status: string;
}

interface OrderReturn {
  id: string;
  receivedAt: string;
  refundAmount: string;
  refundMethod: string;
  reason: string | null;
  status: string;
}

interface OrderDetail {
  id: string;
  number: string;
  status: string;
  orderDate: string;
  channel: { name: string };
  customerName: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  warehouse: { id: string; name: string } | null;
  branchId: string;
  paymentStatus: string;
  paidTotal?: string;
  reconciledAmount?: string;
  courier: string | null;
  trackingNo: string | null;
  shipToAddress: string | null;
  notes: string | null;
  currency: CurrencyCode;
  items: OrderItem[];
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  fulfillments: Fulfillment[];
  payments: OrderPayment[];
  returns: OrderReturn[];
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

export default async function EcommerceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let order: OrderDetail;
  let warehouses: Warehouse[];
  try {
    const data = await backendFetch<{ order: OrderDetail; warehouses: Warehouse[] }>(
      `/api/mobile/ecommerce/orders/${id}`,
    );
    order = data.order;
    warehouses = data.warehouses;
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const currency = order.currency;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.number}`}
        description={`${order.channel.name} · ${order.customerName ?? 'Guest'}`}
      >
        <div className="flex items-center gap-2">
          <OrderPackingSlip
            order={{
              number: order.number,
              orderDate: order.orderDate,
              channelName: order.channel.name,
              customerName: order.customerName,
              customerPhone: order.customerPhone ?? null,
              shipToAddress: order.shipToAddress,
              courier: order.courier,
              trackingNo: order.trackingNo,
              notes: order.notes,
              currency: currency,
              items: order.items,
              subtotal: order.subtotal,
              discountTotal: order.discountTotal,
              shippingTotal: order.shippingTotal,
              taxTotal: order.taxTotal,
              grandTotal: order.grandTotal,
              paidTotal: order.paidTotal ?? '0',
            }}
          />
          <Button variant="outline" asChild>
            <Link href="/ecommerce/orders">
              <ArrowLeft className="h-4 w-4" /> All orders
            </Link>
          </Button>
        </div>
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
                <div className="tabular">{new Date(order.orderDate).toISOString().slice(0, 10)}</div>
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
              {order.customerPhone && (
                <div>
                  <div className="text-xs text-muted-foreground">Customer Phone</div>
                  <div className="font-mono tabular">{order.customerPhone}</div>
                </div>
              )}
              {order.courier && (
                <div>
                  <div className="text-xs text-muted-foreground">Courier</div>
                  <div>
                    {order.courier} {order.trackingNo ? `· #${order.trackingNo}` : ''}
                  </div>
                </div>
              )}
            </div>
            {order.shipToAddress && (
              <div className="text-sm border-t pt-3 text-muted-foreground mt-4">
                <span className="font-medium text-foreground">Ship to:</span> {order.shipToAddress}
              </div>
            )}
            {order.notes && (
              <div className="text-sm border-t pt-3 text-muted-foreground mt-4">
                <span className="font-medium text-foreground">Order Notes:</span> {order.notes}
              </div>
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
                { key: 'qty', header: 'Ordered', align: 'right', cell: (r) => <span className="tabular">{r.quantity}</span> },
                { key: 'packed', header: 'Packed', align: 'right', cell: (r) => <span className="tabular">{r.packedQty}</span> },
                { key: 'fulfilled', header: 'Fulfilled', align: 'right', cell: (r) => <span className="tabular">{r.fulfilledQty}</span> },
                { key: 'returned', header: 'Returned', align: 'right', cell: (r) => <span className="tabular">{r.returnedQty}</span> },
                { key: 'price', header: 'Price', align: 'right', cell: (r) => <span className="tabular">{formatCurrency(r.unitPrice, currency)}</span> },
                { key: 'total', header: 'Line total', align: 'right', cell: (r) => <span className="tabular font-medium">{formatCurrency(r.lineTotal, currency)}</span> },
              ]}
            />
            <div className="border-t p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm max-w-sm ml-auto">
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
                    cell: (r) => (r.shippedAt ? <span className="tabular">{new Date(r.shippedAt).toISOString().slice(0, 10)}</span> : '—'),
                  },
                  {
                    key: 'delivered',
                    header: 'Delivered',
                    cell: (r) => (r.deliveredAt ? <span className="tabular">{new Date(r.deliveredAt).toISOString().slice(0, 10)}</span> : '—'),
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
                  { key: 'date', header: 'Date', cell: (r) => <span className="tabular">{new Date(r.receivedAt).toISOString().slice(0, 10)}</span> },
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
                  { key: 'date', header: 'Received', cell: (r) => <span className="tabular">{new Date(r.receivedAt).toISOString().slice(0, 10)}</span> },
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
