import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { sumDecimal } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/shared/print-button';
import { RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Trial balance' };

const TYPE_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  ASSET: 'success',
  LIABILITY: 'warning',
  EQUITY: 'default',
  INCOME: 'success',
  EXPENSE: 'destructive',
};

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface TrialBalanceRowDto {
  accountId: string;
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
  balance: string;
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; branchId?: string }>;
}) {
  const { asOf, branchId } = await searchParams;
  const asOfDate = asOf ? new Date(asOf) : new Date();

  const queryParams = new URLSearchParams({ asOf: asOfDate.toISOString() });
  if (branchId) queryParams.set('branchId', branchId);

  const [rows, branches] = await Promise.all([
    backendFetch<TrialBalanceRowDto[]>(
      `/api/mobile/reports/financials/trial-balance?${queryParams.toString()}`,
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const totalDebit = sumDecimal(rows.map((r) => r.debit));
  const totalCredit = sumDecimal(rows.map((r) => r.credit));
  const hasFilters = Boolean(asOf || branchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trial balance"
        description={`Summary of general ledger balances as of ${asOfDate.toISOString().slice(0, 10)}`}
      >
        <form className="flex flex-wrap items-center gap-2 no-print">
          {branches.length > 0 && (
            <select
              name="branchId"
              defaultValue={branchId ?? ''}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
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
            name="asOf"
            defaultValue={asOfDate.toISOString().slice(0, 10)}
            className="flex h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
          />
          <Button type="submit" size="sm">
            Update
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts/trial-balance">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Link>
            </Button>
          )}
          <PrintButton />
        </form>
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Code</th>
                <th className="text-left font-semibold px-4 py-3">Account</th>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Debit (BDT)</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Credit (BDT)</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Net Balance (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    No ledger entries found.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.accountId} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.code}</td>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/accounts/ledger?accountId=${r.accountId}`} className="hover:underline hover:text-primary">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={TYPE_VARIANT[r.type] ?? 'outline'}>{r.type}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">{r.debit.toString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">{r.credit.toString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono font-semibold">{r.balance.toString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold border-t">
              <tr>
                <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase">
                  Totals
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-base">{totalDebit.toString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-base">{totalCredit.toString()}</td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums font-mono text-base ${
                    totalDebit.equals(totalCredit) ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {totalDebit.equals(totalCredit) ? '✓ Balanced' : `Diff: ${totalDebit.minus(totalCredit).toString()}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
