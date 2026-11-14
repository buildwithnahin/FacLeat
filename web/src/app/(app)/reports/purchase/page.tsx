import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { formatCurrency } from '@/lib/money';
import { defaultRange, RangeFilter } from '../_components/range-filter';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Purchase report' };

interface PurchaseSummaryDto {
  poCount: number;
  poTotal: string;
  invoiceCount: number;
  invoiceTotal: string;
  invoicePaid: string;
  invoiceOutstanding: string;
  openPayable: string;
  byDepartment: { department: string; count: number; total: string }[];
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

function safeDate(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : val;
}

export default async function PurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = safeDate(sp.from, range.from);
  const to = safeDate(sp.to, range.to);

  const qs = new URLSearchParams({ from: new Date(from).toISOString(), to: new Date(`${to}T23:59:59.999Z`).toISOString() });
  if (sp.branchId && sp.branchId !== 'ALL') qs.set('branchId', sp.branchId);

  const [data, branches] = await Promise.all([
    backendFetch<PurchaseSummaryDto>(`/api/mobile/reports/general/purchase-summary?${qs.toString()}`),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase summary" description={`${from} → ${to}`}>
        <RangeFilter
          from={from}
          to={to}
          branchId={sp.branchId}
          branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
          baseHref="/reports/purchase"
        />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi label="Purchase orders" value={`${data.poCount}`} />
        <Kpi label="PO value" value={formatCurrency(data.poTotal, 'BDT')} />
        <Kpi label="Invoices received" value={`${data.invoiceCount}`} />
        <Kpi label="Invoice value" value={formatCurrency(data.invoiceTotal, 'BDT')} />
        <Kpi label="Paid to suppliers" value={formatCurrency(data.invoicePaid, 'BDT')} />
        <Kpi label="Outstanding payable" value={formatCurrency(data.openPayable, 'BDT')} accent />
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Purchase orders by department</div>
        <DataTable
          rows={data.byDepartment}
          rowKey={(r) => r.department}
          empty="No purchase orders in this range."
          columns={[
            { key: 'department', header: 'Department', cell: (r) => r.department },
            { key: 'count', header: 'Orders', align: 'right', cell: (r) => <span className="tabular">{r.count}</span> },
            {
              key: 'total',
              header: 'Total value',
              align: 'right',
              cell: (r) => <span className="tabular font-medium text-emerald-600">{formatCurrency(r.total, 'BDT')}</span>,
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
