import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { inspectCustomerReturnAction } from '@/server/actions/warehouse-workflows';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReturnInspectionForm } from '@/components/shared/return-inspection-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Return Inspection' };

interface CustomerReturnDetail {
  id: string;
  number: string;
  status: string;
  customerName: string | null;
  sourceDocumentType: string | null;
  sourceDocumentNumber: string | null;
  financeAction: 'NONE' | 'REFUND' | 'EXCHANGE' | 'CREDIT_ADJUSTMENT';
  financeNote: string | null;
  inspectionNote: string | null;
  warehouse: { name: string; code: string };
  inspectionWarehouse: { name: string; code: string };
  items: {
    id: string;
    quantity: string;
    note: string | null;
    disposition?: string | null;
    product: { sku: string; name: string; unit: string };
  }[];
}

export default async function CustomerReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let entry: CustomerReturnDetail;
  try {
    entry = await backendFetch<CustomerReturnDetail>(`/api/mobile/warehouse/returns/${id}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    throw err;
  }

  const disabled = entry.status === 'COMPLETED' || entry.status === 'REJECTED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={entry.number}
        description={`Inspection warehouse: ${entry.inspectionWarehouse.name} (${entry.inspectionWarehouse.code})`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={entry.status === 'COMPLETED' ? 'success' : entry.status === 'REJECTED' ? 'destructive' : 'warning'}>
                {entry.status.replaceAll('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span>{entry.customerName ?? 'Walk-in / unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source</span>
              <span>{entry.sourceDocumentType ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Document #</span>
              <span className="font-mono text-xs">{entry.sourceDocumentNumber ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sellable destination</span>
              <span>{entry.warehouse.name}</span>
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <ReturnInspectionForm
            returnId={entry.id}
            items={entry.items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
              note: item.note,
              disposition: item.disposition,
              product: {
                sku: item.product.sku,
                name: item.product.name,
                unit: item.product.unit,
              },
            }))}
            financeAction={entry.financeAction}
            financeNote={entry.financeNote}
            inspectionNote={entry.inspectionNote}
            action={inspectCustomerReturnAction}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
