import Link from 'next/link';
import { Plus, Eye } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export default async function DebitNotesPage() {
  const debitNotes = await backendFetch<DebitNoteRow[]>('/api/mobile/purchase/returns');

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
