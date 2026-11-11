import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { StepIndicator } from '@/components/shared/step-indicator';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import { OrderActions } from './actions';
import { orderSteps } from '../../_components/steps';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Order' };

const TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  CONFIRMED: 'blue',
  PARTIALLY_DELIVERED: 'amber',
  DELIVERED: 'green',
  INVOICED: 'black',
  CLOSED: 'grey',
  CANCELED: 'red',
};

interface OrderDetail {
  id: string;
  number: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  paymentTerms: string;
  notes: string | null;
  cancelReason: string | null;
  currency: CurrencyCode;
  customer: { code: string; name: string };
  warehouse: { id: string; name: string };
  quote: { id: string; number: string } | null;
  items: {
    id: string;
    product: { name: string; sku: string };
    quantity: string;
    deliveredQty: string;
    invoicedQty: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  deliveries: {
    id: string;
    number: string;
    deliveryDate: string | null;
    trackingNo: string | null;
    transportCompany: string | null;
    items: unknown[];
  }[];
  invoices: {
    id: string;
    number: string;
    invoiceDate: string;
    dueDate: string | null;
    grandTotal: string;
    paidTotal: string;
    balanceDue: string;
    status: string;
  }[];
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let order: OrderDetail;
  try {
    order = await backendFetch<OrderDetail>(`/api/mobile/corporate-sales/orders/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const currency = order.currency;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.number}`}
        description={`${order.customer.code} · ${order.customer.name}`}
      >
        <Button variant="outline" asChild>
          <Link href="/corporate-sales/orders">
            <ArrowLeft className="h-4 w-4" /> All orders
          </Link>
        </Button>
      </PageHeader>

      <StepIndicator steps={orderSteps(order.status, order.deliveries.length > 0)} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Pill tone={TONE[order.status] ?? 'grey'}>
                  {order.status.toLowerCase().replace('_', ' ')}
                </Pill>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Order date</div>
                <div className="tabular">{new Date(order.orderDate).toISOString().slice(0, 10)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Expected</div>
                <div className="tabular">
                  {order.expectedDate ? new Date(order.expectedDate).toISOString().slice(0, 10) : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Terms</div>
                <div>{order.paymentTerms.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Warehouse</div>
                <div>{order.warehouse.name}</div>
              </div>
              {order.quote && (
                <div>
                  <div className="text-xs text-muted-foreground">From quote</div>
                  <Link
                    href={`/corporate-sales/quotes/${order.quote.id}`}
                    className="text-blue-600 hover:underline tabular"
                  >
                    {order.quote.number}
                  </Link>
                </div>
              )}
            </div>
            {order.notes && (
              <div className="text-sm border-t pt-3 text-muted-foreground mt-4">{order.notes}</div>
            )}
            {order.cancelReason && (
              <div className="text-sm text-red-600 border-t pt-3 mt-4">
                Canceled: {order.cancelReason}
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
                      <div className="font-medium">{r.product.name}</div>
                      <div className="text-xs text-muted-foreground">{r.product.sku}</div>
                    </div>
                  ),
                },
                { key: 'qty', header: 'Ordered', align: 'right', cell: (r) => <span className="tabular">{r.quantity.toString()}</span> },
                { key: 'delivered', header: 'Delivered', align: 'right', cell: (r) => <span className="tabular">{r.deliveredQty.toString()}</span> },
                { key: 'invoiced', header: 'Invoiced', align: 'right', cell: (r) => <span className="tabular">{r.invoicedQty.toString()}</span> },
                { key: 'price', header: 'Price', align: 'right', cell: (r) => <span className="tabular">{formatCurrency(r.unitPrice, currency)}</span> },
                { key: 'total', header: 'Line total', align: 'right', cell: (r) => <span className="tabular font-medium">{formatCurrency(r.lineTotal, currency)}</span> },
              ]}
            />
            <div className="border-t p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm max-w-sm ml-auto">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="text-right tabular">{formatCurrency(order.subtotal, currency)}</div>
              <div className="text-muted-foreground">Discount</div>
              <div className="text-right tabular">−{formatCurrency(order.discountTotal, currency)}</div>
              <div className="text-muted-foreground">Tax</div>
              <div className="text-right tabular">{formatCurrency(order.taxTotal, currency)}</div>
              <div className="font-semibold border-t pt-2">Grand total</div>
              <div className="text-right font-semibold tabular border-t pt-2">
                {formatCurrency(order.grandTotal, currency)}
              </div>
            </div>
          </Card>

          {order.deliveries.length > 0 && (
            <Card className="p-0">
              <div className="px-4 py-3 border-b text-sm font-medium">
                Deliveries ({order.deliveries.length})
              </div>
              <DataTable
                rows={order.deliveries}
                rowKey={(r) => r.id}
                empty="—"
                columns={[
                  { key: 'number', header: 'Number', cell: (r) => <span className="tabular">{r.number}</span> },
                  {
                    key: 'date',
                    header: 'Date',
                    cell: (r) =>
                      r.deliveryDate ? (
                        <span className="tabular">{new Date(r.deliveryDate).toISOString().slice(0, 10)}</span>
                      ) : (
                        '—'
                      ),
                  },
                  { key: 'tracking', header: 'Tracking', cell: (r) => r.trackingNo ?? '—' },
                  { key: 'carrier', header: 'Carrier', cell: (r) => r.transportCompany ?? '—' },
                  { key: 'items', header: 'Items', align: 'right', cell: (r) => <span className="tabular">{r.items.length}</span> },
                ]}
              />
            </Card>
          )}

          {order.invoices.length > 0 && (
            <Card className="p-0">
              <div className="px-4 py-3 border-b text-sm font-medium">
                Invoices ({order.invoices.length})
              </div>
              <DataTable
                rows={order.invoices}
                rowKey={(r) => r.id}
                empty="—"
                columns={[
                  {
                    key: 'number',
                    header: 'Number',
                    cell: (r) => (
                      <Link
                        href={`/corporate-sales/invoices/${r.id}`}
                        className="text-blue-600 hover:underline tabular"
                      >
                        {r.number}
                      </Link>
                    ),
                  },
                  { key: 'date', header: 'Date', cell: (r) => <span className="tabular">{new Date(r.invoiceDate).toISOString().slice(0, 10)}</span> },
                  { key: 'due', header: 'Due', cell: (r) => r.dueDate ? <span className="tabular">{new Date(r.dueDate).toISOString().slice(0, 10)}</span> : '—' },
                  { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="tabular">{formatCurrency(r.grandTotal, currency)}</span> },
                  { key: 'paid', header: 'Paid', align: 'right', cell: (r) => <span className="tabular text-emerald-700">{formatCurrency(r.paidTotal, currency)}</span> },
                  { key: 'bal', header: 'Balance', align: 'right', cell: (r) => <span className="tabular text-red-600">{formatCurrency(r.balanceDue, currency)}</span> },
                  { key: 'status', header: 'Status', cell: (r) => <span className="text-xs">{r.status.toLowerCase().replace('_', ' ')}</span> },
                ]}
              />
            </Card>
          )}
        </div>

        <div>
          <OrderActions
            orderId={order.id}
            status={order.status}
            warehouseId={order.warehouse.id}
            warehouseName={order.warehouse.name}
            currency={currency}
            items={order.items.map((i) => ({
              id: i.id,
              name: i.product.name,
              sku: i.product.sku,
              quantity: Number(i.quantity),
              deliveredQty: Number(i.deliveredQty),
              invoicedQty: Number(i.invoicedQty),
              unitPrice: Number(i.unitPrice),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
