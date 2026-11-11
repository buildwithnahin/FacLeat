import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { d, formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

interface GrnDetail {
  id: string;
  number: string;
  status: string;
  receivedDate: string;
  purchaseOrderId: string;
  notes: string | null;
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  purchaseOrder: { id: string; number: string; currency: string };
  items: {
    id: string;
    product: { id: string; sku: string; name: string };
    receivedQty: string;
    rejectedQty: string;
    unitCost: string;
    note: string | null;
  }[];
}

export default async function GrnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let grn: GrnDetail;
  try {
    grn = await backendFetch<GrnDetail>(`/api/mobile/purchase/grn/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const currency = (grn.purchaseOrder?.currency ?? 'BDT') as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchase/grn">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={grn.number}
        description={`${grn.supplier.name} · received at ${grn.warehouse.name}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/purchase/invoices/new?purchaseOrderId=${grn.purchaseOrderId}&grnId=${grn.id}`}>
            <FileText className="h-4 w-4" />
            Record Invoice
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2">
            <Pill tone={grn.status === 'COMPLETED' ? 'green' : grn.status === 'CANCELLED' ? 'red' : 'amber'}>
              {grn.status.toLowerCase()}
            </Pill>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Received date</p>
          <p className="mt-2 text-base font-semibold">
            {new Date(grn.receivedDate).toLocaleDateString()}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">PO reference</p>
          <p className="mt-2 text-base font-semibold tabular">
            <Link
              href={`/purchase/orders/${grn.purchaseOrderId}`}
              className="text-blue-600 hover:underline"
            >
              {grn.purchaseOrder.number}
            </Link>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Warehouse</p>
          <p className="mt-2 text-base font-semibold">{grn.warehouse.name}</p>
        </Card>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Received items</div>
        <DataTable
          rows={grn.items}
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
              key: 'received',
              header: 'Received',
              align: 'right',
              cell: (r) => <span className="tabular text-emerald-600">{r.receivedQty}</span>,
            },
            {
              key: 'rejected',
              header: 'Rejected',
              align: 'right',
              cell: (r) => (
                <span className={`tabular ${d(r.rejectedQty).gt(0) ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {r.rejectedQty}
                </span>
              ),
            },
            {
              key: 'cost',
              header: 'Unit cost',
              align: 'right',
              cell: (r) => <span className="tabular">{formatCurrency(r.unitCost, currency)}</span>,
            },
            { key: 'note', header: 'Note', cell: (r) => r.note ?? '—' },
          ]}
        />
      </Card>

      {grn.notes && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{grn.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
