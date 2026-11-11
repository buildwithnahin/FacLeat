import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
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

export const metadata = { title: 'Letters of Credit' };

const LC_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey', ISSUED: 'blue', ADVISED: 'blue', CONFIRMED: 'green',
  ACTIVE: 'green', AMENDED: 'amber', PARTIALLY_UTILIZED: 'amber',
  FULLY_UTILIZED: 'grey', EXPIRED: 'red', CLOSED: 'grey', CANCELLED: 'red',
};

function isExpiringSoon(expiryDate: string) {
  return new Date(expiryDate).getTime() - Date.now() < 30 * 86400000;
}

const TERMINAL = ['EXPIRED', 'CLOSED', 'CANCELLED', 'FULLY_UTILIZED'];

interface Row {
  id: string;
  number: string;
  type: string;
  status: string;
  currency: CurrencyCode;
  lcAmount: string;
  availableAmount: string;
  expiryDate: string;
  tradeOrder: { id: string; number: string; type: string };
  _count: { drawdowns: number; amendments: number };
}

const columns: DataTableColumn<Row>[] = [
  {
    key: 'number', header: 'LC Number',
    cell: (r) => (
      <Link href={`/trade/lc/${r.id}`} className="font-mono text-primary hover:underline">
        {r.number}
      </Link>
    ),
  },
  {
    key: 'tradeOrder', header: 'Trade Order',
    cell: (r) => (
      <Link href={`/trade/orders/${r.tradeOrder.id}`} className="text-xs text-primary hover:underline">
        {r.tradeOrder.number}
      </Link>
    ),
  },
  {
    key: 'type', header: 'Type',
    cell: (r) => <span className="text-xs">{r.type.replace(/_/g, ' ')}</span>,
  },
  {
    key: 'amount', header: 'LC Amount', align: 'right',
    cell: (r) => formatCurrency(r.lcAmount.toString(), r.currency),
  },
  {
    key: 'available', header: 'Available', align: 'right',
    cell: (r) => formatCurrency(r.availableAmount.toString(), r.currency),
  },
  {
    key: 'expiry', header: 'Expiry',
    cell: (r) => {
      const expiring = isExpiringSoon(r.expiryDate) && !TERMINAL.includes(r.status);
      return (
        <span className={expiring ? 'text-red-600 font-medium flex items-center gap-1' : ''}>
          {expiring && <AlertTriangle className="h-3 w-3 inline mr-1" />}
          {new Date(r.expiryDate).toLocaleDateString()}
        </span>
      );
    },
  },
  {
    key: 'drawdowns', header: 'Drawdowns', align: 'right',
    cell: (r) => r._count.drawdowns,
  },
  {
    key: 'status', header: 'Status',
    cell: (r) => (
      <Pill tone={LC_STATUS_TONE[r.status] ?? 'grey'}>{r.status.replace(/_/g, ' ')}</Pill>
    ),
  },
];

const ALL_LC_STATUSES = [
  'ALL', 'DRAFT', 'ISSUED', 'ADVISED', 'CONFIRMED', 'ACTIVE',
  'AMENDED', 'PARTIALLY_UTILIZED', 'FULLY_UTILIZED', 'EXPIRED', 'CLOSED', 'CANCELLED',
];

export default async function LCListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
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
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);

  const rows = await backendFetch<Row[]>(`/api/mobile/trade/lc?${qs.toString()}`);
  const hasFilter = Boolean(sp.search || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Letters of Credit"
        description="Issue, amend, and track LC drawdowns (UCP 600 compliant)."
      >
        <Button variant="default" asChild>
          <Link href="/trade/lc/new">
            <Plus className="mr-2 h-4 w-4" />
            Issue LC
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
          <Input
            name="search"
            placeholder="Search by LC #, applicant, bank, order…"
            defaultValue={sp.search ?? ''}
          />
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {ALL_LC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" type="submit">Filter</Button>
            {hasFilter && (
              <Button variant="ghost" asChild>
                <Link href="/trade/lc">Clear</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} empty="No letters of credit found." />
    </div>
  );
}
