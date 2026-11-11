import Link from 'next/link';
import { Eye, Plus, Search, X } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Faulty Stock' };

interface DamageReportRow {
  id: string;
  number: string;
  reportDate: string;
  reason: string;
  status: string;
  resolution: string | null;
  estimatedValue: string;
  resolutionNote: string | null;
  warehouse: { name: string; code: string };
  supplier: { name: string } | null;
}

interface SearchParams {
  q?: string;
  status?: string;
}

export default async function FaultyStockPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const statusFilter = params.status && params.status !== 'ALL' ? params.status : undefined;

  const rawRows = await backendFetch<DamageReportRow[]>(
    `/api/mobile/warehouse/damage-reports${branchId ? `?branchId=${branchId}` : ''}`,
  );

  const rows = rawRows.filter((row) => {
    if (query) {
      const matchNumber = row.number.toLowerCase().includes(query);
      const matchReason = row.reason.toLowerCase().includes(query);
      const matchWarehouse = row.warehouse.name.toLowerCase().includes(query) || row.warehouse.code.toLowerCase().includes(query);
      const matchSupplier = row.supplier ? row.supplier.name.toLowerCase().includes(query) : false;
      if (!matchNumber && !matchReason && !matchWarehouse && !matchSupplier) return false;
    }
    if (statusFilter && row.status !== statusFilter) return false;
    return true;
  });

  const hasFilter = Boolean(query || (params.status && params.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faulty Stock"
        description="Damaged items move out of sellable stock into quarantine, then to scrap, repair, B-grade, or supplier claim."
      >
        <Button asChild>
          <Link href="/warehouse/faulty/new">
            <Plus className="h-4 w-4" />
            New damage report
          </Link>
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <Card className="p-4">
        <form method="GET" className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search report #, reason, warehouse, supplier…"
              className="pl-9 h-9"
            />
          </div>

          <select
            name="status"
            defaultValue={params.status ?? 'ALL'}
            className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="IN_QUARANTINE">In quarantine</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>

          {hasFilter && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/warehouse/faulty" className="gap-1">
                <X className="h-3.5 w-3.5" />
                Clear
              </Link>
            </Button>
          )}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Report #</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Source warehouse</th>
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Action taken</th>
                <th className="px-4 py-3 text-right font-semibold">Est. value</th>
                <th className="px-4 py-3 text-right font-semibold">View</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {hasFilter ? 'No faulty stock reports match the selected filters.' : 'No faulty stock reports yet.'}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/warehouse/faulty/${row.id}`} className="text-primary hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.reportDate.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.warehouse.name} ({row.warehouse.code})
                  </td>
                  <td className="px-4 py-3">{row.reason}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        row.status === 'RESOLVED' ? 'success'
                        : row.status === 'REJECTED' ? 'destructive'
                        : row.status === 'PENDING_APPROVAL' ? 'warning'
                        : 'secondary'
                      }
                    >
                      {row.status.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.resolution ? (
                      <div>
                        <div className="font-medium">{row.resolution.replaceAll('_', ' ')}</div>
                        {row.supplier && (
                          <div className="truncate text-xs text-muted-foreground">
                            Supplier: {row.supplier.name}
                          </div>
                        )}
                        {row.resolutionNote && (
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {row.resolutionNote}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular">{row.estimatedValue}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/warehouse/faulty/${row.id}`}>
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
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
