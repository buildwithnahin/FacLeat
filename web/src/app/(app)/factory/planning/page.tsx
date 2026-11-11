import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';

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

export default async function ProductionPlanningPage() {
  const plans = await backendFetch<Plan[]>('/api/mobile/factory/planning');

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

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {plans.length} Plan{plans.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={plans}
          rowKey={(r) => r.id}
          empty="No production plans yet."
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
