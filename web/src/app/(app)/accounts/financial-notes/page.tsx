import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { PrintButton } from '@/components/shared/print-button';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Notes to the Financial Statements' };

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface FinancialNotesDto {
  ppe: {
    openingCost: string;
    additions: string;
    closingCost: string;
    openingAccumDep: string;
    depreciationForYear: string;
    closingAccumDep: string;
    writtenDownValue: string;
    assets: Array<{ name: string; category: string; cost: string; accumDep: string; wdv: string }>;
  };
  inventories: { rawMaterials: string; wip: string; finishedGoods: string; total: string };
  advances: Array<{ code: string; name: string; amount: string }>;
}

export default async function FinancialNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; branchId?: string }>;
}) {
  const sp = await searchParams;

  const asOf = sp.asOf ? new Date(sp.asOf) : new Date();
  const reportParams = new URLSearchParams({ asOf: asOf.toISOString() });
  if (sp.branchId) reportParams.set('branchId', sp.branchId);

  const [data, branches] = await Promise.all([
    backendFetch<FinancialNotesDto>(
      `/api/mobile/reports/financials/notes?${reportParams.toString()}`,
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const asOfLabel = asOf.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const fmt = (n: string | number | null | undefined) =>
    Number(n ?? 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasFilters = Boolean(sp.asOf || sp.branchId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Annex Leather Ltd.</h1>
        <p className="text-base font-semibold text-gray-700">Notes to the Financial Statements</p>
        <p className="text-sm text-muted-foreground">As at {asOfLabel}</p>
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
        <label className="text-sm font-medium self-center">As of:</label>
        <input
          type="date"
          name="asOf"
          defaultValue={asOf.toISOString().slice(0, 10)}
          className="h-9 border rounded-md px-3 py-1 text-sm shadow-sm"
        />
        <Button type="submit" size="sm">
          Apply
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/accounts/financial-notes">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Link>
          </Button>
        )}
        <PrintButton />
      </form>

      {/* Note 4.00 — PP&E */}
      <section className="bg-card border rounded-lg shadow-sm overflow-hidden p-5 space-y-4">
        <h2 className="font-bold text-base border-b pb-2">4.00 Property, Plant and Equipment (Fixed Assets)</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="p-2.5 text-left font-semibold">Particulars</th>
              <th className="p-2.5 text-right font-semibold w-44">Amount (BDT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr>
              <td className="p-2.5 font-medium">Gross Cost (Beginning Balance)</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.ppe.openingCost)}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-6 text-muted-foreground">Add: Additions / Acquisitions during the period</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.ppe.additions ?? '0')}</td>
            </tr>
            <tr className="font-semibold bg-muted/20">
              <td className="p-2.5">Total Historical Cost at End of Period</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.ppe.closingCost)}</td>
            </tr>
            <tr>
              <td className="p-2.5 font-medium">Accumulated Depreciation (Opening)</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.ppe.openingAccumDep)}</td>
            </tr>
            <tr>
              <td className="p-2.5 pl-6 text-muted-foreground">Depreciation Charged during the period</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.ppe.depreciationForYear ?? '0')}</td>
            </tr>
            <tr className="font-semibold bg-muted/20">
              <td className="p-2.5">Total Accumulated Depreciation at End of Period</td>
              <td className="p-2.5 text-right font-mono text-destructive">({fmt(data.ppe.closingAccumDep)})</td>
            </tr>
            <tr className="font-bold border-t-2 bg-muted/40 text-base">
              <td className="p-2.5">Written Down Value (WDV) as at {asOfLabel}</td>
              <td className="p-2.5 text-right font-mono text-primary">{fmt(data.ppe.writtenDownValue)}</td>
            </tr>
          </tbody>
        </table>

        {data.ppe.assets.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Individual Asset Schedule:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="p-2 text-left font-semibold">Asset Name</th>
                    <th className="p-2 text-left font-semibold">Category</th>
                    <th className="p-2 text-right font-semibold">Cost (BDT)</th>
                    <th className="p-2 text-right font-semibold">Accum. Dep. (BDT)</th>
                    <th className="p-2 text-right font-semibold">WDV (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.ppe.assets.map((a, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-2 font-medium">{a.name}</td>
                      <td className="p-2 text-muted-foreground">{a.category}</td>
                      <td className="p-2 text-right font-mono">{fmt(a.cost)}</td>
                      <td className="p-2 text-right font-mono">{fmt(a.accumDep)}</td>
                      <td className="p-2 text-right font-mono font-medium">{fmt(a.wdv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Note 5.00 — Inventories */}
      <section className="bg-card border rounded-lg shadow-sm overflow-hidden p-5 space-y-4">
        <h2 className="font-bold text-base border-b pb-2">5.00 Inventories &amp; Stock Valuation</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="p-2.5 text-left font-semibold">Inventory Classification</th>
              <th className="p-2.5 text-right font-semibold w-44">Amount (BDT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr>
              <td className="p-2.5">Raw Materials (Leather Hides, Chemicals, Hardware)</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.inventories.rawMaterials)}</td>
            </tr>
            <tr>
              <td className="p-2.5">Work-in-Process (Cutting, Stitching, Semi-Finished)</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.inventories.wip)}</td>
            </tr>
            <tr>
              <td className="p-2.5">Finished Goods (Leather Bags, Footwear, Wallets, Accessories)</td>
              <td className="p-2.5 text-right font-mono">{fmt(data.inventories.finishedGoods)}</td>
            </tr>
            <tr className="font-bold border-t-2 bg-muted/30 text-base">
              <td className="p-2.5">Total Inventories Valuation</td>
              <td className="p-2.5 text-right font-mono text-primary">{fmt(data.inventories.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Note 6.00 — Advances */}
      <section className="bg-card border rounded-lg shadow-sm overflow-hidden p-5 space-y-4">
        <h2 className="font-bold text-base border-b pb-2">6.00 Advances, Deposits &amp; Pre-payments</h2>
        {data.advances.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No advance or deposit balances as of this date.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="p-2.5 text-left font-semibold w-24">Code</th>
                <th className="p-2.5 text-left font-semibold">Account Particulars</th>
                <th className="p-2.5 text-right font-semibold w-44">Amount (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.advances.map((a, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="p-2.5 font-mono text-xs text-muted-foreground">{a.code}</td>
                  <td className="p-2.5">{a.name}</td>
                  <td className="p-2.5 text-right font-mono">{fmt(a.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 bg-muted/30 text-base">
                <td colSpan={2} className="p-2.5 text-right uppercase text-xs">Total Advances &amp; Deposits</td>
                <td className="p-2.5 text-right font-mono text-primary">
                  {fmt(data.advances.reduce((s, a) => s + Number(a.amount.toString()), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
