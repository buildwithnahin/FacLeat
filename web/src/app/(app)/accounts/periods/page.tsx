import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NewPeriodForm } from './_components/new-period-form';
import { StatusActionButton } from './_components/status-action-button';
import { Search, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Fiscal periods' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  OPEN: 'success',
  LOCKED: 'warning',
  CLOSED: 'destructive',
};

interface PeriodDto {
  id: string;
  name: string;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
  startsAt: string;
  endsAt: string;
  branch: { code: string; name?: string };
  _count: { journalEntries: number };
}

interface BranchOptionDto {
  id: string;
  code: string;
  name: string;
}

export default async function PeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  const queryParams = new URLSearchParams();
  if (sp.branchId) queryParams.set('branchId', sp.branchId);

  const [periodsData, branches] = await Promise.all([
    backendFetch<PeriodDto[]>(`/api/mobile/accounts/periods?${queryParams.toString()}`),
    backendFetch<BranchOptionDto[]>('/api/mobile/branches'),
  ]);

  const canClose = session?.permissions.includes('accounts:close-period') ?? false;

  const searchLower = (sp.search ?? '').trim().toLowerCase();
  const periods = periodsData.filter((p) => {
    if (!searchLower) return true;
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.branch.code.toLowerCase().includes(searchLower) ||
      (p.branch.name && p.branch.name.toLowerCase().includes(searchLower))
    );
  });

  const hasFilters = Boolean(sp.branchId || sp.search);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal periods"
        description="Control when journal entries can be posted. Lock to freeze, close to seal."
      />

      {canClose && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold mb-3">Create New Fiscal Period</h2>
            <NewPeriodForm branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))} />
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="Search by period name or branch..."
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

            <Button type="submit" size="sm">
              Filter
            </Button>

            {hasFilters && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accounts/periods">
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
                <th className="text-left font-semibold px-4 py-3">Branch</th>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Starts</th>
                <th className="text-left font-semibold px-4 py-3">Ends</th>
                <th className="text-right font-semibold px-4 py-3">Entries</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {periods.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No periods defined yet matching filter.
                  </td>
                </tr>
              )}
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">
                    <span className="font-mono text-xs">{p.branch.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.startsAt.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.endsAt.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{p._count.journalEntries}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {canClose && p.status !== 'CLOSED' && (
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === 'OPEN' && (
                          <StatusActionButton id={p.id} status="LOCKED" label="Lock" />
                        )}
                        {p.status === 'LOCKED' && (
                          <StatusActionButton id={p.id} status="OPEN" label="Reopen" />
                        )}
                        <StatusActionButton id={p.id} status="CLOSED" label="Close" danger />
                      </div>
                    )}
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
