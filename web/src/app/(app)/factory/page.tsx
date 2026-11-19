import Link from 'next/link';
import { Plus, Factory, Clock, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { PRODUCTION_ORDER_STATUS } from '@/server/validators/factory';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Factory' };

type PillTone = 'neutral' | 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';

const STATUS_TONE: Record<(typeof PRODUCTION_ORDER_STATUS)[number], PillTone> = {
  DRAFT: 'grey',
  PLANNED: 'blue',
  IN_PROGRESS: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
  ON_HOLD: 'orange',
};

interface Search {
  status?: string;
  search?: string;
}

interface OrderRow {
  id: string;
  number: string;
  status: (typeof PRODUCTION_ORDER_STATUS)[number];
  plannedQty: string;
  producedQty: string;
  plannedStartDate: string;
  plannedEndDate: string;
  createdAt?: string;
  product: { id: string; sku: string; name: string };
  branch: { id: string; name: string; code: string };
}

interface Summary {
  planned: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export default async function FactoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  const activeBranchId =
    session?.activeBranchId ?? session?.defaultBranchId ?? session?.allowedBranchIds?.[0];

  const listParams = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') listParams.set('status', sp.status);
  if (sp.search) listParams.set('search', sp.search);
  if (activeBranchId) listParams.set('branchId', activeBranchId);

  const { orders, summary } = await backendFetch<{ orders: OrderRow[]; summary: Summary }>(
    `/api/mobile/factory?${listParams.toString()}`,
  );

  const sortedOrders = [...orders].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return b.number.localeCompare(a.number, undefined, { numeric: true });
  });

  const hasFilter = Boolean(sp.search || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Orders"
        description="Plan, track, and close factory production runs"
      >
        <Button variant="dark" asChild>
          <Link href="/factory/new">
            <Plus className="h-4 w-4" />
            New Production Order
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Planned" value={summary.planned} icon={Factory} tone="primary" />
        <KpiCard label="In progress" value={summary.inProgress} icon={Clock} tone="warning" />
        <KpiCard label="Completed" value={summary.completed} icon={CheckCircle2} tone="success" />
        <KpiCard label="Overdue" value={summary.overdue} icon={AlertTriangle} tone="danger" />
      </div>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
          <Input
            name="search"
            placeholder="Search by order number or product…"
            defaultValue={sp.search ?? ''}
          />
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            {PRODUCTION_ORDER_STATUS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {hasFilter && (
              <Button type="button" variant="ghost" asChild>
                <Link href="/factory">
                  <X className="h-4 w-4" /> Clear
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {sortedOrders.length} Order{sortedOrders.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={sortedOrders}
          rowKey={(r) => r.id}
          empty="No production orders yet. Create your first one to begin."
          columns={[
            {
              key: 'number',
              header: 'Number',
              cell: (r) => (
                <Link href={`/factory/${r.id}`} className="text-blue-600 hover:underline tabular font-medium">
                  {r.number}
                </Link>
              ),
            },
            {
              key: 'createdAt',
              header: 'Created',
              cell: (r) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                </span>
              ),
            },
            { key: 'product', header: 'Product', cell: (r) => r.product.name },
            { key: 'sku', header: 'SKU', cell: (r) => <span className="tabular">{r.product.sku}</span> },
            {
              key: 'planned',
              header: 'Planned',
              align: 'right',
              cell: (r) => <span className="tabular">{r.plannedQty.toString()}</span>,
            },
            {
              key: 'produced',
              header: 'Produced',
              align: 'right',
              cell: (r) => <span className="tabular">{r.producedQty.toString()}</span>,
            },
            {
              key: 'dates',
              header: 'Timeline',
              cell: (r) => (
                <div className="text-xs text-muted-foreground">
                  {r.plannedStartDate.slice(0, 10)} → {r.plannedEndDate.slice(0, 10)}
                </div>
              ),
            },
            {
              key: 'branch',
              header: 'Branch',
              cell: (r) => <span className="text-muted-foreground">{r.branch.name}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status]}>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Pill>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
