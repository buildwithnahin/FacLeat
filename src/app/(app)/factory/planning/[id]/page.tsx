import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, X, Factory } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { ApprovalStatusBanner } from '@/components/shared/approval-status-banner';
import { factoryService } from '@/server/services/factory.service';
import { decideProductionPlanAction } from '@/server/actions/factory';
import { getSession } from '@/server/auth/session';
import { NotFoundError } from '@/lib/errors';

type PillTone = 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  APPROVED: 'blue',
  SCHEDULED: 'amber',
  RUNNING: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const ORDER_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  PLANNED: 'blue',
  IN_PROGRESS: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
  ON_HOLD: 'orange',
};

export default async function ProductionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  let plan;
  try {
    plan = await factoryService.getPlan(session, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canDecide = plan.status === 'DRAFT';
  const canConvert = plan.status === 'APPROVED' || plan.status === 'SCHEDULED';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/factory/planning">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={plan.planNo}
        description={`${plan.product.name} (${plan.product.sku}) · ${plan.branch.name}`}
      >
        {canDecide && (
          <>
            <form action={decideProductionPlanAction}>
              <input type="hidden" name="id" value={plan.id} />
              <input type="hidden" name="decision" value="CANCEL" />
              <Button type="submit" variant="outline">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </form>
            <form action={decideProductionPlanAction}>
              <input type="hidden" name="id" value={plan.id} />
              <input type="hidden" name="decision" value="APPROVE" />
              <Button type="submit" variant="dark">
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </form>
          </>
        )}
        {canConvert && (
          <Button variant="dark" asChild>
            <Link href={`/factory/new?planId=${plan.id}`}>
              <Factory className="h-4 w-4" />
              Create Order
            </Link>
          </Button>
        )}
      </PageHeader>

      <ApprovalStatusBanner
        session={session}
        module="factory"
        entityType="ProductionPlan"
        entityId={plan.id}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2">
            <Pill tone={STATUS_TONE[plan.status] ?? 'grey'}>{plan.status.toLowerCase()}</Pill>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Quantity</p>
          <p className="mt-2 text-lg font-semibold tabular">
            {plan.quantity.toString()} {plan.product.unit}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Priority</p>
          <p className="mt-2 text-lg font-semibold">{plan.priority?.toLowerCase() ?? '—'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Timeline</p>
          <p className="mt-2 text-sm">
            {plan.plannedStartDate.toISOString().slice(0, 10)} →{' '}
            {plan.plannedEndDate.toISOString().slice(0, 10)}
          </p>
        </Card>
      </div>

      <Card className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Production line</p>
          <p className="mt-1">{plan.productionLine ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Machine</p>
          <p className="mt-1">{plan.machine ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Shift</p>
          <p className="mt-1">{plan.shift ?? '—'}</p>
        </div>
      </Card>

      {plan.orders.length > 0 && (
        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium">
            Production Orders ({plan.orders.length})
          </div>
          <DataTable
            rows={plan.orders}
            rowKey={(r) => r.id}
            empty="—"
            columns={[
              {
                key: 'number',
                header: 'Number',
                cell: (r) => (
                  <Link href={`/factory/${r.id}`} className="text-blue-600 hover:underline tabular">
                    {r.number}
                  </Link>
                ),
              },
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
                key: 'status',
                header: 'Status',
                cell: (r) => (
                  <Pill tone={ORDER_STATUS_TONE[r.status] ?? 'grey'}>
                    {r.status.replace('_', ' ').toLowerCase()}
                  </Pill>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
