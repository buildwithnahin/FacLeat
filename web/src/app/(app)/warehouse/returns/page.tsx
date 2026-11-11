import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Customer Returns' };

interface CustomerReturnRow {
  id: string;
  number: string;
  returnDate: string;
  customerName: string | null;
  sourceDocumentType: string | null;
  sourceDocumentNumber: string | null;
  status: string;
  warehouse: { name: string; code: string };
  items: { id: string }[];
}

interface SearchParams {
  q?: string;
  status?: string;
}

export default async function CustomerReturnsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const statusFilter = params.status && params.status !== 'ALL' ? params.status : undefined;

  const rawRows = await backendFetch<CustomerReturnRow[]>(
    `/api/mobile/warehouse/returns${branchId ? `?branchId=${branchId}` : ''}`,
  );

  const rows = rawRows.filter((row) => {
    if (query) {
      const matchNumber = row.number.toLowerCase().includes(query);
      const matchCustomer = (row.customerName ?? '').toLowerCase().includes(query);
      const matchDoc = (row.sourceDocumentNumber ?? '').toLowerCase().includes(query);
      const matchWarehouse = row.warehouse.name.toLowerCase().includes(query) || row.warehouse.code.toLowerCase().includes(query);
      if (!matchNumber && !matchCustomer && !matchDoc && !matchWarehouse) return false;
    }
    if (statusFilter && row.status !== statusFilter) return false;
    return true;
  });

  const hasFilter = Boolean(query || (params.status && params.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Returns"
        description="Returned items enter inspection first, then move to sellable, rework, damaged, or rejected."
      >
        <Button asChild>
          <Link href="/warehouse/returns/new">
            <Plus className="h-4 w-4" />
            New return
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
              placeholder="Search return #, customer, document #…"
              className="pl-9 h-9"
            />
          </div>

          <select
            name="status"
            defaultValue={params.status ?? 'ALL'}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING_INSPECTION">Pending inspection</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>

          {hasFilter && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/warehouse/returns" className="gap-1">
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
                <th className="px-4 py-3 text-left font-semibold">Return #</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Source</th>
                <th className="px-4 py-3 text-left font-semibold">Destination</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {hasFilter ? 'No returns match the selected filters.' : 'No customer return cases yet.'}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/warehouse/returns/${row.id}`} className="text-primary hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.returnDate.slice(0, 10)}</td>
                  <td className="px-4 py-3">{row.customerName ?? 'Walk-in / unknown'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.sourceDocumentType ?? '—'} {row.sourceDocumentNumber ? `· ${row.sourceDocumentNumber}` : ''}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.warehouse.name} ({row.warehouse.code})
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.status === 'COMPLETED' ? 'success' : row.status === 'REJECTED' ? 'destructive' : 'warning'}>
                      {row.status.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular">{row.items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
