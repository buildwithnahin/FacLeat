import Link from 'next/link';
import { Plus, Search, RotateCcw } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Journal entries' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'warning',
  POSTED: 'success',
  VOIDED: 'destructive',
};

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface JournalEntryDto {
  id: string;
  number: string;
  date: string;
  branch: { code: string };
  period: { name: string };
  reference: string | null;
  memo: string | null;
  totalDebit: string;
  totalCredit: string;
  status: string;
}

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    branchId?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  const queryParams = new URLSearchParams({ take: '200' });
  if (sp.search) queryParams.set('search', sp.search);
  if (sp.branchId) queryParams.set('branchId', sp.branchId);
  if (sp.status) queryParams.set('status', sp.status);
  if (sp.from) queryParams.set('from', sp.from);
  if (sp.to) queryParams.set('to', sp.to);

  const [entries, branches] = await Promise.all([
    backendFetch<JournalEntryDto[]>(`/api/mobile/accounts/journals?${queryParams.toString()}`),
    backendFetch<BranchDto[]>('/api/mobile/branches'),
  ]);

  const canPost = session?.permissions.includes('accounts:post') ?? false;
  const hasFilters = Boolean(sp.search || sp.branchId || sp.status || sp.from || sp.to);

  const postedCount = entries.filter((e) => e.status === 'POSTED').length;
  const draftCount = entries.filter((e) => e.status === 'DRAFT').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Journal entries" description="All manual and system-generated ledger entries.">
        {canPost && (
          <Button asChild>
            <Link href="/accounts/journals/new">
              <Plus className="h-4 w-4 mr-1" />
              New journal
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground font-semibold">Total Entries Shown</div>
            <div className="text-2xl font-bold mt-1">{entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground font-semibold">Posted Entries</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{postedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground font-semibold">Draft Entries</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{draftCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="Search number, memo, reference..."
                defaultValue={sp.search ?? ''}
                className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-transparent text-sm shadow-sm"
              />
            </div>

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

            <select
              name="status"
              defaultValue={sp.status ?? ''}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            >
              <option value="">All Statuses</option>
              <option value="POSTED">POSTED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="VOIDED">VOIDED</option>
            </select>

            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ''}
              className="h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
              title="From date"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ''}
              className="h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm"
              title="To date"
            />

            <Button type="submit" size="sm">
              Filter
            </Button>

            {hasFilters && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accounts/journals">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                </Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Number</th>
                <th className="text-left font-semibold px-4 py-3">Date</th>
                <th className="text-left font-semibold px-4 py-3">Branch</th>
                <th className="text-left font-semibold px-4 py-3">Period</th>
                <th className="text-left font-semibold px-4 py-3">Reference</th>
                <th className="text-left font-semibold px-4 py-3">Memo</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Debit</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Credit</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={9}>
                    No journal entries found matching criteria.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/accounts/journals/${e.id}`} className="text-primary hover:underline font-semibold">
                      {e.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.date.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-medium">{e.branch.code}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.period.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.reference ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{e.memo ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{e.totalDebit}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{e.totalCredit}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[e.status] ?? 'outline'}>{e.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
