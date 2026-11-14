import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { Decimal, d } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/shared/print-button';
import { RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Income statement' };

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface IncomeStatementRowDto {
  id: string;
  code: string;
  name: string;
  amount: string;
}

interface IncomeStatementDto {
  income: IncomeStatementRowDto[];
  expense: IncomeStatementRowDto[];
  totals: { income: string; expense: string; net: string };
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const sp = await searchParams;
  const { from: defaultFrom, to: defaultTo } = defaultRange();
  const fromStr = sp.from ?? defaultFrom;
  const toStr = sp.to ?? defaultTo;

  const reportParams = new URLSearchParams({
    from: new Date(fromStr).toISOString(),
    to: new Date(toStr).toISOString(),
  });
  if (sp.branchId) reportParams.set('branchId', sp.branchId);

  const [report, branches] = await Promise.all([
    backendFetch<IncomeStatementDto>(
      `/api/mobile/reports/financials/income-statement?${reportParams.toString()}`,
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const hasFilters = Boolean(sp.from || sp.to || sp.branchId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income statement"
        description={`Statement of Profit & Loss · ${fromStr} → ${toStr}`}
      >
        <form className="flex flex-wrap items-center gap-2 no-print">
          {branches.length > 0 && (
            <select
              name="branchId"
              defaultValue={sp.branchId ?? ''}
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
            name="from"
            defaultValue={fromStr}
            className="flex h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="date"
            name="to"
            defaultValue={toStr}
            className="flex h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
          />
          <Button type="submit" size="sm">
            Update
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts/income-statement">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Link>
            </Button>
          )}
          <PrintButton />
        </form>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section
          title="Revenue / Income"
          rows={report.income}
          total={d(report.totals.income)}
          color="text-emerald-600"
        />
        <Section
          title="Operating Expenses"
          rows={report.expense}
          total={d(report.totals.expense)}
          color="text-destructive"
        />
      </div>

      <Card className="mt-6">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <KpiCell label="Total Revenue / Income" value={report.totals.income} color="text-emerald-600" />
          <KpiCell label="Total Operating Expenses" value={report.totals.expense} color="text-destructive" />
          <KpiCell
            label="Net Profit / (Loss)"
            value={report.totals.net}
            color={d(report.totals.net).gte(0) ? 'text-emerald-600' : 'text-destructive'}
          />
        </div>
      </Card>
    </div>
  );
}

function KpiCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  rows,
  total,
  color,
}: {
  title: string;
  rows: { id: string; code: string; name: string; amount: string }[];
  total: Decimal;
  color: string;
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
                No activity recorded in range.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2 font-mono text-xs w-24 text-muted-foreground">{r.code}</td>
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-4 py-2 text-right tabular-nums font-mono">{r.amount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 font-semibold border-t">
          <tr>
            <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">
              Total {title}
            </td>
            <td className={`px-4 py-2 text-right tabular-nums font-mono text-base ${color}`}>
              {total.toString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
