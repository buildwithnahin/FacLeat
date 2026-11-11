import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  DRAFT: 'grey',
  POSTED: 'green',
  CANCELLED: 'red',
} as const;

interface DebitNoteDetail {
  id: string;
  number: string;
  status: string;
  returnDate: string;
  totalAmount: string;
  reason: string | null;
  supplier: { id: string; name: string; currency: string };
  invoice: { id: string; number: string } | null;
  grn: { id: string; number: string } | null;
  items: {
    id: string;
    product: { id: string; sku: string; name: string };
    returnedQty: string;
    unitPrice: string;
    total: string;
    condition: string | null;
    reason: string | null;
  }[];
}

export default async function DebitNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let debitNote: DebitNoteDetail;
  try {
    debitNote = await backendFetch<DebitNoteDetail>(`/api/mobile/purchase/returns/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const currency = debitNote.supplier.currency as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchase/returns">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={debitNote.number}
        description={`${debitNote.supplier.name} · Returned ${new Date(debitNote.returnDate).toLocaleDateString()}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2">
            <Pill tone={STATUS_TONE[debitNote.status as keyof typeof STATUS_TONE] ?? 'grey'}>
              {debitNote.status.toLowerCase()}
            </Pill>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Total returned value</p>
          <p className="mt-2 text-2xl font-semibold tabular">
            {formatCurrency(debitNote.totalAmount, currency)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Linked invoice</p>
          <div className="mt-2">
            {debitNote.invoice ? (
              <Link
                href={`/purchase/invoices/${debitNote.invoice.id}`}
                className="text-blue-600 hover:underline tabular"
              >
                {debitNote.invoice.number}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Linked GRN</p>
          <div className="mt-2">
            {debitNote.grn ? (
              <Link
                href={`/purchase/grn/${debitNote.grn.id}`}
                className="text-blue-600 hover:underline tabular"
              >
                {debitNote.grn.number}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Returned items</div>
        <DataTable
          rows={debitNote.items}
          rowKey={(r) => r.id}
          empty="No items"
          columns={[
            {
              key: 'product',
              header: 'Product',
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.product.name}</p>
                  <p className="text-xs text-muted-foreground tabular">{r.product.sku}</p>
                </div>
              ),
            },
            {
              key: 'qty',
              header: 'Returned qty',
              align: 'right',
              cell: (r) => <span className="tabular">{r.returnedQty.toString()}</span>,
            },
            {
              key: 'price',
              header: 'Unit price',
              align: 'right',
              cell: (r) => <span className="tabular">{formatCurrency(r.unitPrice, currency)}</span>,
            },
            {
              key: 'total',
              header: 'Line total',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">{formatCurrency(r.total, currency)}</span>
              ),
            },
            {
              key: 'condition',
              header: 'Condition',
              cell: (r) => r.condition ?? '—',
            },
            {
              key: 'reason',
              header: 'Reason',
              cell: (r) => r.reason ?? '—',
            },
          ]}
        />
      </Card>

      {debitNote.reason && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Return reason</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{debitNote.reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
