import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/money';
import { defaultRange, RangeFilter } from '../_components/range-filter';
import { TopProductsExportButton } from './top-products-export-button';
import { BarChart3, DollarSign, PackageCheck, Award } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Top Products Performance | Annex Leather' };

interface TopProductRow {
  productId: string;
  sku: string;
  name: string;
  qty: string;
  revenue: string;
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

export default async function TopProductsReportPage({
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
    limit: '50',
  });
  if (sp.branchId && sp.branchId !== 'ALL') qs.set('branchId', sp.branchId);

  const [rows, branches] = await Promise.all([
    backendFetch<TopProductRow[]>(`/api/mobile/reports/general/top-products?${qs.toString()}`).catch(
      () => [] as TopProductRow[],
    ),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  const totalQtySold = rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
  const avgRealization = totalQtySold > 0 ? totalRevenue / totalQtySold : 0;
  const topProduct = rows[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Top Selling Products"
          description={`Product velocity & revenue contribution: ${from} → ${to}`}
        />
        <div className="flex items-center gap-2">
          <TopProductsExportButton products={rows} from={from} to={to} />
        </div>
      </div>

      <RangeFilter
        from={from}
        to={to}
        branchId={sp.branchId}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
        baseHref="/reports/top-products"
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between shadow-sm border">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Units Sold
            </p>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {totalQtySold.toLocaleString()}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <PackageCheck className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-sm border">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ranked Revenue
            </p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">
              {formatCurrency(totalRevenue, 'BDT')}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-sm border">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Avg Realization / Unit
            </p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(avgRealization, 'BDT')}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <BarChart3 className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between shadow-sm border">
          <div className="max-w-[70%]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              #1 Best Seller
            </p>
            <p className="text-sm font-bold mt-1 text-foreground truncate">
              {topProduct ? topProduct.name : '—'}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">
              {topProduct ? `${Number(topProduct.qty).toLocaleString()} pcs` : 'None'}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Award className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Main Ranking Table */}
      <Card className="overflow-hidden shadow-sm border">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <span>Top {rows.length} Ranked Products</span>
          <span className="text-xs text-muted-foreground">
            Ranked by total quantity sold across all channels
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase font-medium border-b">
              <tr>
                <th className="text-center font-semibold px-4 py-3 w-12">Rank</th>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product Name</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Qty Sold</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Sales Revenue</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Avg Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No sales recorded in the selected period.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const q = Number(r.qty) || 0;
                  const rev = Number(r.revenue) || 0;
                  const unitAvg = q > 0 ? rev / q : 0;
                  return (
                    <tr key={r.productId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                            i === 0
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : i === 1
                                ? 'bg-slate-200 text-slate-800'
                                : i === 2
                                  ? 'bg-orange-100 text-orange-900'
                                  : 'text-muted-foreground'
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground font-semibold">
                        {r.sku}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        {q.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600">
                        {formatCurrency(r.revenue, 'BDT')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground font-mono">
                        {formatCurrency(unitAvg, 'BDT')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
