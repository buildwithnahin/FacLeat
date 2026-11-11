import Link from 'next/link';
import { Plus, Eye, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Purchase Returns' };

const STATUS_TONE = {
  DRAFT: 'grey',
  POSTED: 'green',
  CANCELLED: 'red',
} as const;

interface DebitNoteRow {
  id: string;
  number: string;
  status: string;
  returnDate: string;
  totalAmount: string;
  supplier: { id: string; name: string; currency: string };
  items: { id: string }[];
}

export default async function DebitNotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; status?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') params.set('status', sp.status);
  if (sp.search?.trim()) params.set('search', sp.search.trim());
  const debitNotes = await backendFetch<DebitNoteRow[]>(`/api/mobile/purchase/returns?${params.toString()}`);
  const isFiltered = Boolean(sp.search?.trim() || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Returns" description="Debit notes issued against suppliers for returned goods">
        <Button variant="dark" asChild>
          <Link href="/purchase/returns/new">
            <Plus className="h-4 w-4" />
            Create Return
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search Debit Note #, supplier, reason…"
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
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {isFiltered && (
            <Button variant="ghost" asChild>
              <Link href="/purchase/returns">Clear</Link>
            </Button>
          )}
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          All Returns ({debitNotes.length})
        </div>
        <DataTable
          rows={debitNotes}
          rowKey={(r) => r.id}
          empty="No returns yet."
          columns={[
            {
              key: 'number',
              header: 'Debit Note #',
              cell: (r) => (
                <Link
                  href={`/purchase/returns/${r.id}`}
                  className="text-blue-600 hover:underline tabular"
                >
                  {r.number}
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
              key: 'date',
              header: 'Return Date',
              cell: (r) => new Date(r.returnDate).toLocaleDateString(),
            },
            {
              key: 'items',
              header: 'Items',
              align: 'right',
              cell: (r) => <span className="tabular">{r.items.length}</span>,
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">
                  {formatCurrency(r.totalAmount, r.supplier.currency as CurrencyCode)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? 'grey'}>
                  {r.status.toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (r) => (
                <Link
                  href={`/purchase/returns/${r.id}`}
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
