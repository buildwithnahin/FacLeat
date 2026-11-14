import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { d } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Account ledger' };

interface CoaListAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  normalSide: string;
  isPosting: boolean;
}

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface LedgerRowDto {
  id: string;
  date: string;
  entryId: string;
  number: string;
  branchCode: string;
  memo: string;
  debit: string;
  credit: string;
  balance: string;
}

interface AccountLedgerDto {
  account: { code: string; name: string; normalSide: string; type: string };
  opening: string;
  rows: LedgerRowDto[];
  closing: string;
}

export default async function AccountLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string;
    branchId?: string;
    from?: string;
    to?: string;
    q?: string;
    type?: string;
  }>;
}) {
  const sp = await searchParams;
  const [allAccounts, branches] = await Promise.all([
    backendFetch<CoaListAccountDto[]>('/api/mobile/coa?activeOnly=true'),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const postingAccounts = allAccounts.filter((a) => a.isPosting);

  if (!sp.accountId) {
    const qLower = (sp.q ?? '').trim().toLowerCase();
    const typeFilter = sp.type ?? '';

    const filteredAccounts = postingAccounts.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (qLower) {
        return (
          a.code.toLowerCase().includes(qLower) ||
          a.name.toLowerCase().includes(qLower) ||
          a.type.toLowerCase().includes(qLower)
        );
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Account ledger"
          description="Pick a posting account to inspect its detailed transaction history and balance."
        />

        <Card>
          <CardContent className="p-4 space-y-4">
            <form method="get" className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search accounts by code or name..."
                  defaultValue={sp.q ?? ''}
                  className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-sm"
                />
              </div>
              <select
                name="type"
                defaultValue={typeFilter}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                <option value="">All Account Types</option>
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="INCOME">INCOME</option>
                <option value="EXPENSE">EXPENSE</option>
              </select>
              <Button type="submit" size="sm">
                Filter
              </Button>
              {(sp.q || sp.type) && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/accounts/ledger">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                  </Link>
                </Button>
              )}
            </form>

            <div className="divide-y text-sm max-h-[600px] overflow-y-auto">
              {filteredAccounts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No posting accounts match your search.
                </div>
              ) : (
                filteredAccounts.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                        {a.code}
                      </span>
                      <span className="font-medium">{a.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {a.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Normal: {a.normalSide}</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/accounts/ledger?accountId=${a.id}`}>View Ledger</Link>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ledgerParams = new URLSearchParams({ accountId: sp.accountId });
  if (sp.branchId) ledgerParams.set('branchId', sp.branchId);
  if (sp.from) ledgerParams.set('from', sp.from);
  if (sp.to) ledgerParams.set('to', sp.to);

  const ledger = await backendFetch<AccountLedgerDto>(
    `/api/mobile/accounts/ledger?${ledgerParams.toString()}`,
  );

  const hasFilters = Boolean(sp.branchId || sp.from || sp.to);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2 -ml-2">
              <Link href="/accounts/ledger">
                <ArrowLeft className="h-4 w-4 mr-1" /> All Accounts
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ledger.account.code} · {ledger.account.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Normal Side: <span className="font-semibold">{ledger.account.normalSide}</span> · Type:{' '}
            <span className="font-semibold">{ledger.account.type}</span>
          </p>
        </div>

        {/* Quick Account Switcher & Filters */}
        <form method="get" className="flex flex-wrap items-center gap-2">
          <select
            name="accountId"
            defaultValue={sp.accountId}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm font-medium"
          >
            {postingAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>

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
            defaultValue={sp.from ?? ''}
            className="flex h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
            title="From date"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ''}
            className="flex h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
            title="To date"
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/accounts/ledger?accountId=${sp.accountId}`}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Link>
            </Button>
          )}
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Date</th>
                <th className="text-left font-semibold px-4 py-3">Entry Number</th>
                <th className="text-left font-semibold px-4 py-3">Branch</th>
                <th className="text-left font-semibold px-4 py-3">Memo / Description</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Debit</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Credit</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="bg-muted/30 font-medium">
                <td colSpan={6} className="px-4 py-2.5 text-xs uppercase text-muted-foreground text-right">
                  Opening Balance {sp.from ? `(as of ${sp.from})` : ''}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{ledger.opening}</td>
              </tr>
              {ledger.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No posted transactions in the selected date range.
                  </td>
                </tr>
              )}
              {ledger.rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">{r.date.slice(0, 10)}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/accounts/journals/${r.entryId}`} className="text-primary hover:underline font-semibold">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">{r.branchCode}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{r.memo || '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {d(r.debit).greaterThan(0) ? r.debit : ''}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {d(r.credit).greaterThan(0) ? r.credit : ''}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{r.balance}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold border-t">
              <tr>
                <td colSpan={6} className="px-4 py-2.5 text-right text-xs uppercase">
                  Closing Balance {sp.to ? `(as of ${sp.to})` : ''}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-base">{ledger.closing}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
