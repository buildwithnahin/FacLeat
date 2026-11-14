import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { d } from '@/lib/money';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Statement of Changes in Equity' };

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface ChangesInEquityDto {
  current: {
    period: number;
    openingShareCapital: string;
    shareCapitalAdded: string;
    closeShareCapital: string;
    openingRetained: string;
    netProfit: string;
    closingRetained: string;
    totalEquity: string;
  };
}

export default async function EquityChangesPage({
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
    backendFetch<ChangesInEquityDto>(
      `/api/mobile/reports/financials/changes-in-equity?${reportParams.toString()}`,
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const c = data.current;

  const fmt = (n: string | null | undefined) => {
    const num = Number(n ?? 0);
    const abs = Math.abs(num).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num < 0 ? `(${abs})` : abs;
  };

  const hasFilters = Boolean(sp.from || sp.to || sp.branchId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Annex Leather Ltd.</h1>
        <p className="text-base font-semibold text-gray-700">Statement of Changes in Equity</p>
        <p className="text-sm text-muted-foreground">
          For the period ended {to.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
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
            <Link href="/accounts/equity-changes">
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
              <th className="p-3 text-left font-semibold">Particulars</th>
              <th className="p-3 text-right font-semibold w-40">Share / Owner's Capital</th>
              <th className="p-3 text-right font-semibold w-40">Retained Earnings</th>
              <th className="p-3 text-right font-semibold w-40">Total Equity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr>
              <td className="p-3 font-medium">
                Beginning Balance (as of {from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
              </td>
              <td className="p-3 text-right font-mono">{fmt(c.openingShareCapital)}</td>
              <td className="p-3 text-right font-mono">{fmt(c.openingRetained)}</td>
              <td className="p-3 text-right font-mono font-medium">
                {fmt(d(c.openingShareCapital).plus(c.openingRetained).toString())}
              </td>
            </tr>
            {d(c.shareCapitalAdded).abs().gt(0) && (
              <tr>
                <td className="p-3 pl-6 text-muted-foreground">Add: Additional Capital / Share Issuance</td>
                <td className="p-3 text-right font-mono">{fmt(c.shareCapitalAdded)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">—</td>
                <td className="p-3 text-right font-mono">{fmt(c.shareCapitalAdded)}</td>
              </tr>
            )}
            <tr>
              <td className="p-3 pl-6 text-muted-foreground">Net Profit / (Loss) for the period</td>
              <td className="p-3 text-right font-mono text-muted-foreground">—</td>
              <td className={`p-3 text-right font-mono ${d(c.netProfit).gte(0) ? 'text-emerald-600' : 'text-destructive'}`}>
                {fmt(c.netProfit)}
              </td>
              <td className={`p-3 text-right font-mono ${d(c.netProfit).gte(0) ? 'text-emerald-600' : 'text-destructive'}`}>
                {fmt(c.netProfit)}
              </td>
            </tr>
            <tr className="font-bold border-t-2 bg-muted/30">
              <td className="p-3">
                Ending Balance as of {to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="p-3 text-right font-mono text-base">{fmt(c.closeShareCapital)}</td>
              <td className="p-3 text-right font-mono text-base">{fmt(c.closingRetained)}</td>
              <td className="p-3 text-right font-mono text-lg text-primary">{fmt(c.totalEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-16 text-sm px-6">
        <div className="text-center">
          <div className="border-t border-foreground/50 w-44 pt-1 font-medium">Chief Financial Officer</div>
        </div>
        <div className="text-center">
          <div className="border-t border-foreground/50 w-44 pt-1 font-medium">Managing Director</div>
        </div>
      </div>
    </div>
  );
}
