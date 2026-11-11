import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Production Planning' };

type PillTone = 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  APPROVED: 'blue',
  SCHEDULED: 'amber',
  RUNNING: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const PLAN_STATUSES = ['DRAFT', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'] as const;

interface Plan {
  id: string;
  planNo: string;
  quantity: string;
  priority: string | null;
  status: string;
  plannedStartDate: string;
  plannedEndDate: string;
  product: { id: string; sku: string; name: string };
  branch: { id: string; name: string; code: string };
  orders: { id: string; number: string; status: string }[];
}

interface SearchParams {
  status?: string;
  search?: string;
}

export default async function ProductionPlanningPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const [session, sp] = await Promise.all([
    getSession(),
    searchParams ? await searchParams : ({} as SearchParams),
  ]);

  const activeBranchId =
    session?.activeBranchId ?? session?.defaultBranchId ?? session?.allowedBranchIds?.[0];

  const listParams = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') listParams.set('status', sp.status);
  if (sp.search) listParams.set('search', sp.search);
  if (activeBranchId) listParams.set('branchId', activeBranchId);

  const plans = await backendFetch<Plan[]>(`/api/mobile/factory/planning?${listParams.toString()}`);

  const hasFilter = Boolean(sp.search || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader title="Production Planning" description="Plan production runs ahead of committing to an order">
        <Button variant="dark" asChild>
          <Link href="/factory/planning/new">
            <Plus className="h-4 w-4" />
            New Plan
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
          <Input
            name="search"
            placeholder="Search by plan # or product…"
            defaultValue={sp.search ?? ''}
          />
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {hasFilter && (
              <Button type="button" variant="ghost" asChild>
                <Link href="/factory/planning">
                  <X className="h-4 w-4" /> Clear
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {plans.length} Plan{plans.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={plans}
          rowKey={(r) => r.id}
          empty="No production plans found."
          columns={[
            {
              key: 'planNo',
              header: 'Plan #',
              cell: (r) => (
                <Link href={`/factory/planning/${r.id}`} className="text-blue-600 hover:underline tabular">
                  {r.planNo}
                </Link>
              ),
            },
            { key: 'product', header: 'Product', cell: (r) => r.product.name },
            {
              key: 'qty',
              header: 'Quantity',
              align: 'right',
              cell: (r) => <span className="tabular">{r.quantity.toString()}</span>,
            },
            { key: 'priority', header: 'Priority', cell: (r) => r.priority?.toLowerCase() ?? '—' },
            {
              key: 'dates',
              header: 'Timeline',
              cell: (r) => (
                <div className="text-xs text-muted-foreground">
                  {new Date(r.plannedStartDate).toISOString().slice(0, 10)} →{' '}
                  {new Date(r.plannedEndDate).toISOString().slice(0, 10)}
                </div>
              ),
            },
            { key: 'branch', header: 'Branch', cell: (r) => <span className="text-muted-foreground">{r.branch.name}</span> },
            {
              key: 'orders',
              header: 'Orders',
              align: 'right',
              cell: (r) => <span className="tabular">{r.orders.length}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.toLowerCase()}</Pill>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
