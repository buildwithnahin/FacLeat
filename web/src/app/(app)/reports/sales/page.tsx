import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/money';
import { defaultRange, RangeFilter } from '../_components/range-filter';
import { ShoppingBag, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sales Performance & Channels Report | Annex Leather' };

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

  const qs = new URLSearchParams({
    from: new Date(from).toISOString(),
    to: new Date(`${to}T23:59:59.999Z`).toISOString(),
  });
  if (sp.branchId && sp.branchId !== 'ALL') qs.set('branchId', sp.branchId);

  const [data, branches] = await Promise.all([
    backendFetch<SalesSummaryDto>(
      `/api/mobile/reports/general/sales-summary?${qs.toString()}`,
    ).catch(
      () =>
        ({
          channels: [],
          totals: { count: 0, gross: '0', discount: '0', tax: '0', paid: '0', outstanding: '0' },
        }) as SalesSummaryDto,
    ),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  const totalGross = Number(data.totals.gross) || 0;
  const totalPaid = Number(data.totals.paid) || 0;
  const totalOutstanding = Number(data.totals.outstanding) || 0;
  const collectionRate = totalGross > 0 ? ((totalPaid / totalGross) * 100).toFixed(1) : '100';

  const exportHref = `/api/reports/sales.csv?from=${from}&to=${to}${
    sp.branchId && sp.branchId !== 'ALL' ? `&branchId=${sp.branchId}` : ''
  }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Omnichannel Sales Summary"
          description={`Consolidated revenue performance across all channels: ${from} → ${to}`}
        />
      </div>

      <RangeFilter
        from={from}
        to={to}
        branchId={sp.branchId}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
        exportHref={exportHref}
        baseHref="/reports/sales"
      />

      {/* KPI Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Gross Sales Revenue
            </span>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatCurrency(totalGross, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across {data.totals.count} total customer invoices
          </p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Collected / Paid
            </span>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600">
            {formatCurrency(totalPaid, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {collectionRate}% realized cash collections
          </p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Accounts Receivable Due
            </span>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600">
            {formatCurrency(totalOutstanding, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Outstanding credit balances</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total Invoices Issued
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">{data.totals.count}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Orders & bills billed</p>
        </Card>
      </div>

      {/* Channel Distribution Breakdown Table */}
      <Card className="overflow-hidden shadow-sm border">
        <div className="px-5 py-3.5 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <span className="font-semibold">Revenue Distribution by Sales Channel</span>
          <span className="text-xs text-muted-foreground">
            {data.channels.length} Channels Analyzed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-medium border-b">
              <tr>
                <th className="text-left font-semibold px-5 py-3">Channel / Stream</th>
                <th className="text-right font-semibold px-4 py-3">Invoices</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Gross Sales</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Share %</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Discounts</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Tax / VAT</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Collected</th>
                <th className="text-right font-semibold px-5 py-3 tabular-nums">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.channels.map((c) => {
                const cGross = Number(c.gross) || 0;
                const sharePct = totalGross > 0 ? ((cGross / totalGross) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={c.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-semibold text-foreground text-xs">
                      {c.label}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                      {c.count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-xs">
                      {formatCurrency(c.gross, 'BDT')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-mono">
                      <span className="inline-block px-2 py-0.5 rounded bg-muted/50 font-medium">
                        {sharePct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                      {formatCurrency(c.discount, 'BDT')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                      {formatCurrency(c.tax, 'BDT')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold text-emerald-600">
                      {formatCurrency(c.paid, 'BDT')}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-xs font-semibold text-amber-600">
                      {formatCurrency(c.outstanding, 'BDT')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40 font-bold border-t text-xs">
              <tr>
                <td className="px-5 py-3 uppercase tracking-wider">Consolidated Totals</td>
                <td className="px-4 py-3 text-right tabular-nums">{data.totals.count}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">
                  {formatCurrency(data.totals.gross, 'BDT')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-mono">100.0%</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(data.totals.discount, 'BDT')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(data.totals.tax, 'BDT')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                  {formatCurrency(data.totals.paid, 'BDT')}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-amber-700">
                  {formatCurrency(data.totals.outstanding, 'BDT')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
