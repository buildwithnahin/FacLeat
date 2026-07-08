import { getSession } from '@/server/auth/session';
import { reportsService } from '@/server/services/reports.service';
import { branchService } from '@/server/services/branch.service';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { defaultRange, RangeFilter } from '../_components/range-filter';

export const metadata = { title: 'Production report' };

type PillTone = 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  PLANNED: 'blue',
  IN_PROGRESS: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
  ON_HOLD: 'orange',
};

export default async function ProductionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const sp = await searchParams;
  const d = defaultRange();
  const from = sp.from ?? d.from;
  const to = sp.to ?? d.to;

  const session = await getSession();
  const [data, branches] = await Promise.all([
    reportsService.productionSummary(session, {
      from: new Date(from),
      to: new Date(to + 'T23:59:59.999Z'),
      branchId: sp.branchId || undefined,
    }),
    branchService.listAccessible(session),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Production output reconciliation" description={`${from} → ${to}`}>
        <RangeFilter
          from={from}
          to={to}
          branchId={sp.branchId}
          branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
        />
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Orders" value={`${data.totals.orderCount}`} />
        <Kpi label="Planned qty" value={data.totals.plannedQty.toString()} />
        <Kpi label="Produced qty" value={data.totals.producedQty.toString()} />
        <Kpi label="Overall yield" value={`${data.totals.overallYield.toString()}%`} accent />
        <Kpi label="Scrap qty" value={data.totals.scrapQty.toString()} />
        <Kpi label="Scrap cost" value={data.totals.scrapCost.toString()} />
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Planned vs actual by order</div>
        <DataTable
          rows={data.rows}
          rowKey={(r) => r.id}
          empty="No production orders in this range."
          columns={[
            { key: 'number', header: 'Order #', cell: (r) => <span className="tabular">{r.number}</span> },
            { key: 'product', header: 'Product', cell: (r) => r.product.name },
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
              key: 'variance',
              header: 'Variance',
              align: 'right',
              cell: (r) => (
                <span className={`tabular ${r.variance.lt(0) ? 'text-red-600' : 'text-emerald-600'}`}>
                  {r.variance.toString()}
                </span>
              ),
            },
            {
              key: 'yield',
              header: 'Yield %',
              align: 'right',
              cell: (r) => <span className="tabular font-medium">{r.yieldPercent.toString()}%</span>,
            },
            {
              key: 'scrap',
              header: 'Scrap qty',
              align: 'right',
              cell: (r) => <span className="tabular">{r.scrapQty.toString()}</span>,
            },
            {
              key: 'onTime',
              header: 'On time',
              cell: (r) =>
                r.onTime === null ? (
                  <span className="text-muted-foreground text-xs">—</span>
                ) : (
                  <Pill tone={r.onTime ? 'green' : 'red'}>{r.onTime ? 'on time' : 'late'}</Pill>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.replace('_', ' ').toLowerCase()}</Pill>,
            },
          ]}
        />
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Scrap by source</div>
        <DataTable
          rows={data.scrapByType}
          rowKey={(r) => r.scrapType}
          empty="No scrap recorded in this range."
          columns={[
            { key: 'source', header: 'Source', cell: (r) => r.scrapType.replace('_', ' ').toLowerCase() },
            { key: 'count', header: 'Entries', align: 'right', cell: (r) => <span className="tabular">{r.count}</span> },
            { key: 'qty', header: 'Qty', align: 'right', cell: (r) => <span className="tabular">{r.qty.toString()}</span> },
            {
              key: 'cost',
              header: 'Cost',
              align: 'right',
              cell: (r) => <span className="tabular font-medium">{r.cost.toString()}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent ? 'text-primary' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
