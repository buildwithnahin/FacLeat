import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency, d, type CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'POS Sales' };

const STATUS_TONE: Record<string, PillTone> = {
  COMPLETED: 'green',
  VOIDED: 'red',
  REFUNDED: 'amber',
  PARTIALLY_REFUNDED: 'amber',
};

interface SaleRow {
  id: string;
  number: string;
  saleDate: string;
  customer: { id: string; code: string; name: string } | null;
  _count: { items: number; payments: number };
  grandTotal: string;
  currency: CurrencyCode;
  creditAmount: string;
  status: string;
}

export default async function SalesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);

  const sales = await backendFetch<SaleRow[]>(`/api/mobile/pos/sales?${qs.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader title="POS Sales" description="All completed sales and refunds.">
        <Button variant="dark" asChild>
          <Link href="/pos">Open terminal</Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <Input name="search" placeholder="Search by number or customer…" defaultValue={sp.search ?? ''} />
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PARTIALLY_REFUNDED">Partially refunded</option>
            <option value="REFUNDED">Refunded</option>
            <option value="VOIDED">Voided</option>
          </select>
          <Button variant="outline" type="submit">Filter</Button>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {sales.length} sale{sales.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={sales}
          rowKey={(r) => r.id}
          empty="No sales yet."
          columns={[
            {
              key: 'number',
              header: 'Number',
              cell: (r) => (
                <Link href={`/pos/sales/${r.id}`} className="text-blue-600 hover:underline tabular">
                  {r.number}
                </Link>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              cell: (r) => <span className="tabular">{new Date(r.saleDate).toISOString().slice(0, 16).replace('T', ' ')}</span>,
            },
            {
              key: 'customer',
              header: 'Customer',
              cell: (r) => (r.customer ? `${r.customer.code} · ${r.customer.name}` : 'Walk-in'),
            },
            {
              key: 'items',
              header: 'Items',
              align: 'right',
              cell: (r) => <span className="tabular">{r._count.items}</span>,
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              cell: (r) => <span className="tabular font-medium">{formatCurrency(r.grandTotal, r.currency)}</span>,
            },
            {
              key: 'credit',
              header: 'Credit',
              align: 'right',
              cell: (r) =>
                d(r.creditAmount).gt(0) ? (
                  <span className="tabular text-amber-700">{formatCurrency(r.creditAmount, r.currency)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.toLowerCase().replace('_', ' ')}</Pill>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
