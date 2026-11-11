import Link from 'next/link';
import { Plus, Eye, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { AlertBanner } from '@/components/shared/alert-banner';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Goods Receive Note (GRN)' };

interface GrnRow {
  id: string;
  number: string;
  status: string;
  receivedDate: string;
  purchaseOrder: { id: string; number: string };
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  items: { id: string }[];
}

export default async function GrnIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; status?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') params.set('status', sp.status);
  if (sp.search?.trim()) params.set('search', sp.search.trim());
  const grns = await backendFetch<GrnRow[]>(`/api/mobile/purchase/grn?${params.toString()}`);
  const isFiltered = Boolean(sp.search?.trim() || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receive Note (GRN)"
        description="Receive and record incoming goods"
      >
        <Button variant="dark" asChild>
          <Link href="/purchase/grn/new">
            <Plus className="h-4 w-4" />
            Receive Goods
          </Link>
        </Button>
      </PageHeader>

      <AlertBanner tone="danger" title="GOLDEN RULE">
        No inventory can enter the system without a GRN. All goods must be properly received and
        recorded.
      </AlertBanner>

      <StepIndicator
        steps={[
          { key: 'pr', label: 'PR', state: 'completed' },
          { key: 'po', label: 'PO Sent', state: 'completed' },
          { key: 'grn', label: 'Receive Goods (GRN)', state: 'active' },
          { key: 'invoice', label: 'Invoice', state: 'pending' },
          { key: 'payment', label: 'Payment', state: 'pending' },
        ]}
      />

      <Card className="p-4">
        <form className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search GRN #, PO #, supplier…"
              defaultValue={sp.search ?? ''}
              className="pl-9"
            />
          </div>
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {isFiltered && (
            <Button variant="ghost" asChild>
              <Link href="/purchase/grn">Clear</Link>
            </Button>
          )}
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">All GRN Records ({grns.length})</div>
        <DataTable
          rows={grns}
          rowKey={(r) => r.id}
          empty="No GRNs yet. Receive goods against an approved PO to start."
          columns={[
            {
              key: 'number',
              header: 'GRN ID',
              cell: (r) => (
                <Link
                  href={`/purchase/grn/${r.id}`}
                  className="text-blue-600 hover:underline tabular"
                >
                  {r.number}
                </Link>
              ),
            },
            {
              key: 'po',
              header: 'PO Reference',
              cell: (r) => (
                <Link
                  href={`/purchase/orders/${r.purchaseOrder.id}`}
                  className="text-blue-600 hover:underline tabular"
                >
                  {r.purchaseOrder.number}
                </Link>
              ),
            },
            {
              key: 'supplier',
              header: 'Supplier',
              cell: (r) => (
                <Link href={`/suppliers/${r.supplier.id}`} className="text-blue-600 hover:underline">
                  {r.supplier.name}
                </Link>
              ),
            },
            {
              key: 'items',
              header: 'Items',
              cell: (r) => `${r.items.length} items`,
            },
            {
              key: 'warehouse',
              header: 'Warehouse',
              cell: (r) => `${r.warehouse.name}`,
            },
            {
              key: 'date',
              header: 'Received Date',
              cell: (r) => new Date(r.receivedDate).toLocaleDateString(),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={r.status === 'COMPLETED' ? 'green' : r.status === 'CANCELLED' ? 'red' : 'amber'}>
                  {r.status.toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (r) => (
                <Link
                  href={`/purchase/grn/${r.id}`}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
