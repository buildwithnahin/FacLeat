import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { defaultRange, RangeFilter } from '../_components/range-filter';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sales report' };

interface SalesChannel {
  key: string;
  label: string;
  count: number;
  gross: string;
  discount: string;
  tax: string;
  paid: string;
  outstanding: string;
}

interface SalesSummaryDto {
  channels: SalesChannel[];
  totals: Omit<SalesChannel, 'key' | 'label'>;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default async function SalesReportPage({
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
    backendFetch<SalesSummaryDto>(`/api/mobile/reports/general/sales-summary?${qs.toString()}`),
    backendFetch<Branch[]>('/api/mobile/branches'),
  ]);

  const exportHref = `/api/reports/sales.csv?from=${from}&to=${to}${sp.branchId ? `&branchId=${sp.branchId}` : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Sales summary" description={`${from} → ${to}`}>
        <RangeFilter
          from={from}
          to={to}
          branchId={sp.branchId}
          branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
          exportHref={exportHref}
        />
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Channel</th>
                <th className="text-right font-semibold px-4 py-3">Invoices</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Gross</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Discount</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Tax</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Paid</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.channels.map((c) => (
                <tr key={c.key}>
                  <td className="px-4 py-2 font-medium">{c.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.gross}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.discount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.tax}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.paid}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.outstanding}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold">
              <tr>
                <td className="px-4 py-2">Totals</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.count}</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.gross}</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.discount}</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.tax}</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.paid}</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.outstanding}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
