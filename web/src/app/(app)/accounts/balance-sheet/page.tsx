import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { Decimal, d } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/shared/print-button';
import { RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Balance sheet' };

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface BalanceSheetRowDto {
  code: string;
  name: string;
  balance: string;
  debit: string;
  credit: string;
}

interface BalanceSheetDto {
  asset: BalanceSheetRowDto[];
  liability: BalanceSheetRowDto[];
  equity: BalanceSheetRowDto[];
  totals: {
    asset: string;
    liability: string;
    equity: string;
    retained: string;
    liabilityPlusEquity: string;
  };
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; branchId?: string }>;
}) {
  const { asOf, branchId } = await searchParams;
  const asOfDate = asOf ? new Date(asOf) : new Date();

  const reportParams = new URLSearchParams({ asOf: asOfDate.toISOString() });
  if (branchId) reportParams.set('branchId', branchId);

  const [bs, branches] = await Promise.all([
    backendFetch<BalanceSheetDto>(
      `/api/mobile/reports/financials/balance-sheet?${reportParams.toString()}`,
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const hasFilters = Boolean(asOf || branchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balance sheet"
        description={`Statement of Financial Position as of ${asOfDate.toISOString().slice(0, 10)}`}
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
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          />
          <Button type="submit" size="sm">
            Update
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts/balance-sheet">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Link>
            </Button>
          )}
          <PrintButton />
        </form>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section
          title="Assets"
          rows={bs.asset.map((r) => ({
            code: r.code,
            name: r.name,
            amount: d(r.debit).minus(r.credit),
          }))}
          total={d(bs.totals.asset)}
        />
        <div className="space-y-6">
          <Section
            title="Liabilities"
            rows={bs.liability.map((r) => ({
              code: r.code,
              name: r.name,
              amount: d(r.credit).minus(r.debit),
            }))}
            total={d(bs.totals.liability)}
          />
          <Section
            title="Equity"
            rows={[
              ...bs.equity.map((r) => ({
                code: r.code,
                name: r.name,
                amount: d(r.credit).minus(r.debit),
              })),
              {
                code: '—',
                name: 'Retained earnings (accumulated & period)',
                amount: d(bs.totals.retained),
              },
            ]}
            total={d(bs.totals.equity).plus(bs.totals.retained)}
          />
        </div>
      </div>

      <Card className="mt-6">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total Assets
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1">{bs.totals.asset}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Liabilities + Equity
            </div>
            <div
              className={`text-2xl font-bold tabular-nums mt-1 ${
                d(bs.totals.asset).equals(bs.totals.liabilityPlusEquity)
                  ? 'text-emerald-600'
                  : 'text-destructive'
              }`}
            >
              {bs.totals.liabilityPlusEquity}
              {d(bs.totals.asset).equals(bs.totals.liabilityPlusEquity) && (
                <span className="text-xs ml-2 font-normal text-emerald-600">✓ In balance</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Section({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { code: string; name: string; amount: Decimal }[];
  total: Decimal;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground text-xs" colSpan={3}>
                No accounts.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={`${r.code}-${i}`}>
              <td className="px-4 py-2 font-mono text-xs w-24 text-muted-foreground">{r.code}</td>
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono">{r.amount.toString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 font-semibold border-t">
          <tr>
            <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">
              Total {title}
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-mono text-base">{total.toString()}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
