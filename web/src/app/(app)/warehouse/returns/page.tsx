import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

export default async function CustomerReturnsPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId;
  const rows = await backendFetch<CustomerReturnRow[]>(
    `/api/mobile/warehouse/returns${branchId ? `?branchId=${branchId}` : ''}`,
  );

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
                    No customer return cases yet.
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
