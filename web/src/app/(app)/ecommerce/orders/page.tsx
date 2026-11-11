import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency, type CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'E-commerce Orders' };

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

const STATUSES = [
  'ALL',
  'SYNCED',
  'PACKING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'PARTIALLY_RETURNED',
  'RETURNED',
];

interface OrderRow {
  id: string;
  number: string;
  orderDate: string;
  channel: { name: string };
  customerName: string | null;
  items: unknown[];
  grandTotal: string;
  paidTotal: string;
  currency: CurrencyCode;
  status: string;
}

export default async function EcommerceOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);

  const orders = await backendFetch<OrderRow[]>(`/api/mobile/ecommerce/orders?${qs.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Synced online orders and fulfillment status." />

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[220px_auto] gap-3 items-end">
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Button variant="outline" type="submit">Filter</Button>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {orders.length} order{orders.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={orders}
          rowKey={(r) => r.id}
          empty="No orders yet."
          columns={[
            {
              key: 'number',
              header: 'Number',
              cell: (r) => (
                <Link href={`/ecommerce/orders/${r.id}`} className="text-blue-600 hover:underline tabular">
                  {r.number}
                </Link>
              ),
            },
            { key: 'date', header: 'Date', cell: (r) => <span className="tabular">{new Date(r.orderDate).toISOString().slice(0, 10)}</span> },
            { key: 'channel', header: 'Channel', cell: (r) => r.channel.name },
            { key: 'customer', header: 'Customer', cell: (r) => r.customerName ?? '—' },
            { key: 'items', header: 'Items', align: 'right', cell: (r) => <span className="tabular">{r.items.length}</span> },
            { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="tabular font-medium">{formatCurrency(r.grandTotal, r.currency)}</span> },
            { key: 'paid', header: 'Paid', align: 'right', cell: (r) => <span className="tabular text-emerald-700">{formatCurrency(r.paidTotal, r.currency)}</span> },
            { key: 'status', header: 'Status', cell: (r) => <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.toLowerCase().replace(/_/g, ' ')}</Pill> },
          ]}
        />
      </Card>
    </div>
  );
}
