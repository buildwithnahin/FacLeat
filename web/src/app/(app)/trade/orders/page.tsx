import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency, type CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Trade Orders' };

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey', CONFIRMED: 'blue', IN_PRODUCTION: 'amber', READY_TO_SHIP: 'amber',
  SHIPPED: 'blue', AT_CUSTOMS: 'amber', DELIVERED: 'green', COMPLETED: 'green', CANCELLED: 'red',
};

const ORDER_STATUSES = [
  'ALL', 'DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP',
  'SHIPPED', 'AT_CUSTOMS', 'DELIVERED', 'COMPLETED', 'CANCELLED',
];

interface Row {
  id: string;
  number: string;
  type: 'EXPORT' | 'IMPORT';
  status: string;
  currency: CurrencyCode;
  totalValue: string;
  customer: { id: string; name: string; code: string } | null;
  supplier: { id: string; name: string; code: string } | null;
  lc: { id: string; number: string; status: string; lcAmount: string; currency: CurrencyCode } | null;
  _count: { shipments: number; items: number };
}

const columns: DataTableColumn<Row>[] = [
  {
    key: 'number', header: 'Order #',
    cell: (r) => (
      <Link href={`/trade/orders/${r.id}`} className="font-mono text-primary hover:underline">
        {r.number}
      </Link>
    ),
  },
  {
    key: 'type', header: 'Type',
    cell: (r) => <Pill tone={r.type === 'EXPORT' ? 'blue' : 'amber'}>{r.type}</Pill>,
  },
  {
    key: 'counterparty', header: 'Counterparty',
    cell: (r) => r.customer?.name ?? r.supplier?.name ?? '—',
  },
  {
    key: 'value', header: 'Value', align: 'right',
    cell: (r) => formatCurrency(r.totalValue.toString(), r.currency),
  },
  {
    key: 'lc', header: 'LC',
    cell: (r) => r.lc ? (
      <Pill tone="green">{r.lc.number}</Pill>
    ) : <span className="text-muted-foreground text-xs">No LC</span>,
  },
  {
    key: 'shipments', header: 'Shipments', align: 'right',
    cell: (r) => r._count.shipments,
  },
  {
    key: 'status', header: 'Status',
    cell: (r) => (
      <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.replace(/_/g, ' ')}</Pill>
    ),
  },
];

export default async function TradeOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; search?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;

  const qs = new URLSearchParams();
  if (branchId) qs.set('branchId', branchId);
  if (sp.type && sp.type !== 'ALL') qs.set('type', sp.type);
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);

  const rows = await backendFetch<Row[]>(`/api/mobile/trade/orders?${qs.toString()}`);
  const hasFilter = Boolean(sp.search || (sp.status && sp.status !== 'ALL') || (sp.type && sp.type !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader title="Trade Orders" description="Export and import order management.">
        <Button variant="default" asChild>
          <Link href="/trade/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_160px_180px_auto] gap-3 items-end">
          <Input
            name="search"
            placeholder="Search by order #, contract, party…"
            defaultValue={sp.search ?? ''}
          />
          <select
            name="type"
            defaultValue={sp.type ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="ALL">All types</option>
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
          </select>
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" type="submit">Filter</Button>
            {hasFilter && (
              <Button variant="ghost" asChild>
                <Link href="/trade/orders">Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        empty="No trade orders found."
      />
    </div>
  );
}
