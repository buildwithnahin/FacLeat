import { backendFetch } from '@/lib/backend-client';
import { Decimal, d } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Balance sheet' };

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
  searchParams: Promise<{ asOf?: string }>;
}) {
  const { asOf } = await searchParams;
  const asOfDate = asOf ? new Date(asOf) : new Date();
  const bs = await backendFetch<BalanceSheetDto>(
    `/api/mobile/reports/financials/balance-sheet?asOf=${asOfDate.toISOString()}`,
  );

  return (
    <div>
      <PageHeader
        title="Balance sheet"
        description={`Financial position as of ${asOfDate.toISOString().slice(0, 10)}`}
      >
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="asOf"
            defaultValue={asOfDate.toISOString().slice(0, 10)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
          <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Update</button>
        </form>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Assets" rows={bs.asset.map((r) => ({ code: r.code, name: r.name, amount: d(r.balance) }))} total={d(bs.totals.asset)} />
        <div className="space-y-6">
          <Section
            title="Liabilities"
            rows={bs.liability.map((r) => ({ code: r.code, name: r.name, amount: d(r.credit).minus(r.debit) }))}
            total={d(bs.totals.liability)}
          />
          <Section
            title="Equity"
            rows={[
              ...bs.equity.map((r) => ({ code: r.code, name: r.name, amount: d(r.credit).minus(r.debit) })),
              { code: '—', name: 'Retained earnings (current period)', amount: d(bs.totals.retained) },
            ]}
            total={d(bs.totals.equity).plus(bs.totals.retained)}
          />
        </div>
      </div>

      <Card className="mt-6">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total assets</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{bs.totals.asset}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Liabilities + Equity</div>
            <div
              className={`text-2xl font-semibold tabular-nums mt-1 ${
                d(bs.totals.asset).equals(bs.totals.liabilityPlusEquity) ? 'text-emerald-600' : 'text-destructive'
              }`}
            >
              {bs.totals.liabilityPlusEquity}
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
              <td className="px-4 py-2 font-mono text-xs w-24">{r.code}</td>
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.amount.toString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 font-semibold">
          <tr>
            <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">Total {title}</td>
            <td className="px-4 py-2 text-right tabular-nums">{total.toString()}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
