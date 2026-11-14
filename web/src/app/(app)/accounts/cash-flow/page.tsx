import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Statement of Cash Flows' };

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface CashFlowStatementDto {
  operating: { netProfit: string; depreciation: string; inventoryChange: string; total: string };
  investing: { assetPurchases: string; total: string };
  financing: { shareCapitalChange: string; total: string };
  netChange: string;
  openingCash: string;
  closingCash: string;
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const sp = await searchParams;

  const now = new Date();
  const from = sp.from ? new Date(sp.from) : new Date(now.getFullYear(), 0, 1);
  const to = sp.to ? new Date(sp.to) : now;

  const reportParams = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  if (sp.branchId) reportParams.set('branchId', sp.branchId);

  const [data, branches] = await Promise.all([
    backendFetch<CashFlowStatementDto>(
      `/api/mobile/reports/financials/cash-flow-statement?${reportParams.toString()}`,
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const fmt = (n: string | null | undefined, parens = false) => {
    const num = Number(n ?? 0);
    const abs = Math.abs(num).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num < 0) return parens ? `(${abs})` : `-${abs}`;
    return abs;
  };

  const fmtLabel = from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const toLabel = to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const hasFilters = Boolean(sp.from || sp.to || sp.branchId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Annex Leather Ltd.</h1>
        <p className="text-base font-semibold text-gray-700">Statement of Cash Flows (Indirect Method)</p>
        <p className="text-sm text-muted-foreground">For the period {fmtLabel} to {toLabel}</p>
      </div>

      <form method="get" className="flex flex-wrap items-center justify-center gap-3 no-print bg-card p-3 rounded-lg border">
        {branches.length > 0 && (
          <select
            name="branchId"
            defaultValue={sp.branchId ?? ''}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          name="from"
          defaultValue={from.toISOString().slice(0, 10)}
          className="h-9 border rounded-md px-3 py-1 text-sm shadow-sm"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <input
          type="date"
          name="to"
          defaultValue={to.toISOString().slice(0, 10)}
          className="h-9 border rounded-md px-3 py-1 text-sm shadow-sm"
        />
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts/cash-flow">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Link>
          </Button>
        )}
        <PrintButton />
      </form>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left p-3 font-semibold">Particulars</th>
              <th className="text-right p-3 font-semibold w-40">Amount (BDT)</th>
              <th className="text-right p-3 font-semibold w-40">Total (BDT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {/* Section A */}
            <tr className="font-semibold bg-muted/20">
              <td className="p-2.5 pt-3 text-primary" colSpan={3}>
                A) Cash Flows from Operating Activities
              </td>
            </tr>
            <tr>
              <td className="p-2.5 pl-6">Net Profit / (Loss) for the period</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.operating.netProfit, true)}</td>
              <td></td>
            </tr>
            <tr>
              <td className="p-2.5 pl-6">Adjustments for non-cash items: Depreciation</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.operating.depreciation, true)}</td>
              <td></td>
            </tr>
            <tr className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
              <td className="p-2.5 pl-6" colSpan={3}>
                Working Capital Changes:
              </td>
            </tr>
            <tr>
              <td className="p-2.5 pl-8">Increase / (Decrease) in Inventories</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.operating.inventoryChange, true)}</td>
              <td></td>
            </tr>
            <tr className="font-bold border-t bg-muted/30">
              <td className="p-2.5">Net Cash Provided / (Used) by Operating Activities</td>
              <td></td>
              <td className="p-2.5 text-right font-mono text-base">{fmt(data.operating.total, true)}</td>
            </tr>

            {/* Section B */}
            <tr className="font-semibold bg-muted/20">
              <td className="p-2.5 pt-3 text-primary" colSpan={3}>
                B) Cash Flows from Investing Activities
              </td>
            </tr>
            <tr>
              <td className="p-2.5 pl-6">Acquisition of Fixed Assets (Capital Expenditures)</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.investing.assetPurchases, true)}</td>
              <td></td>
            </tr>
            <tr className="font-bold border-t bg-muted/30">
              <td className="p-2.5">Net Cash Provided / (Used) by Investing Activities</td>
              <td></td>
              <td className="p-2.5 text-right font-mono text-base">{fmt(data.investing.total, true)}</td>
            </tr>

            {/* Section C */}
            <tr className="font-semibold bg-muted/20">
              <td className="p-2.5 pt-3 text-primary" colSpan={3}>
                C) Cash Flows from Financing Activities
              </td>
            </tr>
            <tr>
              <td className="p-2.5 pl-6">Increase / (Decrease) in Share Capital / Equity</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.financing.shareCapitalChange, true)}</td>
              <td></td>
            </tr>
            <tr className="font-bold border-t bg-muted/30">
              <td className="p-2.5">Net Cash Provided / (Used) by Financing Activities</td>
              <td></td>
              <td className="p-2.5 text-right font-mono text-base">{fmt(data.financing.total, true)}</td>
            </tr>

            {/* Summary */}
            <tr className="border-t-2 font-bold bg-muted/40">
              <td className="p-3">D) Net Increase / (Decrease) in Cash and Cash Equivalents (A + B + C)</td>
              <td></td>
              <td className="p-3 text-right font-mono text-base">{fmt(data.netChange, true)}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-4">E) Cash and Cash Equivalents at Beginning of the Period</td>
              <td></td>
              <td className="p-2.5 text-right font-mono">{fmt(data.openingCash, true)}</td>
            </tr>
            <tr className="font-bold border-t bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
              <td className="p-3 pl-4">F) Cash and Cash Equivalents at End of the Period (D + E)</td>
              <td></td>
              <td className="p-3 text-right font-mono text-lg">{fmt(data.closingCash, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-16 text-sm px-6">
        <div className="text-center">
          <div className="border-t border-foreground/50 w-44 pt-1 font-medium">Head of Accounts</div>
        </div>
        <div className="text-center">
          <div className="border-t border-foreground/50 w-44 pt-1 font-medium">Managing Director</div>
        </div>
      </div>
    </div>
  );
}
