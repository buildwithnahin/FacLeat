import { backendFetch } from '@/lib/backend-client';
import { d } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { defaultRange, RangeFilter } from '../_components/range-filter';

export const dynamic = 'force-dynamic';

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

interface ProductionRow {
  id: string;
  number: string;
  product: { id: string; sku: string; name: string };
  status: string;
  plannedQty: string;
  producedQty: string;
  variance: string;
  yieldPercent: string;
  scrapQty: string;
  scrapCost: string;
  onTime: boolean | null;
}

interface ProductionSummaryDto {
  rows: ProductionRow[];
  totals: {
    plannedQty: string;
    producedQty: string;
    scrapQty: string;
    scrapCost: string;
    overallYield: string;
    orderCount: number;
  };
  scrapByType: { scrapType: string; count: number; qty: string; cost: string }[];
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default async function ProductionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = sp.from ?? range.from;
  const to = sp.to ?? range.to;

  const qs = new URLSearchParams({ from: new Date(from).toISOString(), to: new Date(`${to}T23:59:59.999Z`).toISOString() });
  if (sp.branchId) qs.set('branchId', sp.branchId);

  const [data, branches] = await Promise.all([
    backendFetch<ProductionSummaryDto>(`/api/mobile/reports/general/production-summary?${qs.toString()}`),
    backendFetch<Branch[]>('/api/mobile/branches'),
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
        <Kpi label="Planned qty" value={data.totals.plannedQty} />
        <Kpi label="Produced qty" value={data.totals.producedQty} />
        <Kpi label="Overall yield" value={`${data.totals.overallYield}%`} accent />
        <Kpi label="Scrap qty" value={data.totals.scrapQty} />
        <Kpi label="Scrap cost" value={data.totals.scrapCost} />
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
              cell: (r) => <span className="tabular">{r.plannedQty}</span>,
            },
            {
              key: 'produced',
              header: 'Produced',
              align: 'right',
              cell: (r) => <span className="tabular">{r.producedQty}</span>,
            },
            {
              key: 'variance',
              header: 'Variance',
              align: 'right',
              cell: (r) => (
                <span className={`tabular ${d(r.variance).lt(0) ? 'text-red-600' : 'text-emerald-600'}`}>
                  {r.variance}
                </span>
              ),
            },
            {
              key: 'yield',
              header: 'Yield %',
              align: 'right',
              cell: (r) => <span className="tabular font-medium">{r.yieldPercent}%</span>,
            },
            {
              key: 'scrap',
              header: 'Scrap qty',
              align: 'right',
              cell: (r) => <span className="tabular">{r.scrapQty}</span>,
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
            { key: 'qty', header: 'Qty', align: 'right', cell: (r) => <span className="tabular">{r.qty}</span> },
            {
              key: 'cost',
              header: 'Cost',
              align: 'right',
              cell: (r) => <span className="tabular font-medium">{r.cost}</span>,
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
