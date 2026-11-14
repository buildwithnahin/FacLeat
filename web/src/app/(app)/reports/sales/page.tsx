import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/money';
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

function safeDate(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : val;
}

export default async function SalesReportPage({
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
    backendFetch<SalesSummaryDto>(`/api/mobile/reports/general/sales-summary?${qs.toString()}`),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  const exportHref = `/api/reports/sales.csv?from=${from}&to=${to}${sp.branchId && sp.branchId !== 'ALL' ? `&branchId=${sp.branchId}` : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Sales summary" description={`${from} → ${to}`}>
        <RangeFilter
          from={from}
          to={to}
          branchId={sp.branchId}
          branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
          exportHref={exportHref}
          baseHref="/reports/sales"
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
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(c.gross, 'BDT')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(c.discount, 'BDT')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(c.tax, 'BDT')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(c.paid, 'BDT')}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-amber-600">{formatCurrency(c.outstanding, 'BDT')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold">
              <tr>
                <td className="px-4 py-2">Totals</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.count}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(data.totals.gross, 'BDT')}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(data.totals.discount, 'BDT')}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(data.totals.tax, 'BDT')}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(data.totals.paid, 'BDT')}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-600">{formatCurrency(data.totals.outstanding, 'BDT')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
