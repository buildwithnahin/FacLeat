import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  rejectDamageReportAction,
  resolveDamageReportAction,
} from '@/server/actions/warehouse-workflows';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DamageResolutionForm } from '@/components/shared/damage-resolution-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Damage Report' };

interface DamageReportDetail {
  id: string;
  number: string;
  status: string;
  reason: string;
  estimatedValue: string;
  resolution: string | null;
  resolutionNote: string | null;
  claimAmount: string;
  claimReference: string | null;
  warehouse: { name: string; code: string };
  quarantineWarehouse: { name: string; code: string };
  supplier: { name: string } | null;
  grn: { number: string } | null;
  purchaseInvoice: { number: string } | null;
  items: { id: string; quantity: string; product: { name: string; unit: string } }[];
  suppliers: { id: string; name: string; code: string }[];
  grns: { id: string; number: string; supplierId: string }[];
  purchaseInvoices: { id: string; number: string; supplierId: string }[];
}

export default async function DamageReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSession();

  let entry: DamageReportDetail;
  try {
    entry = await backendFetch<DamageReportDetail>(`/api/mobile/warehouse/damage-reports/${id}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    throw err;
  }

  const disabled = entry.status === 'RESOLVED' || entry.status === 'REJECTED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={entry.number}
        description={`Quarantine warehouse: ${entry.quarantineWarehouse.name} (${entry.quarantineWarehouse.code})`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={
                  entry.status === 'RESOLVED' ? 'success'
                  : entry.status === 'REJECTED' ? 'destructive'
                  : entry.status === 'PENDING_APPROVAL' ? 'warning'
                  : 'secondary'
                }
              >
                {entry.status.replaceAll('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source warehouse</span>
              <span>{entry.warehouse.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reason</span>
              <span>{entry.reason}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated value</span>
              <span className="tabular">{entry.estimatedValue}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Action taken</span>
              <span>{entry.resolution ? entry.resolution.replaceAll('_', ' ') : 'Pending'}</span>
            </div>
            {entry.supplier && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Supplier</span>
                <span>{entry.supplier.name}</span>
              </div>
            )}
            {entry.grn && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">GRN</span>
                <span className="font-mono text-xs">{entry.grn.number}</span>
              </div>
            )}
            {entry.purchaseInvoice && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Purchase invoice</span>
                <span className="font-mono text-xs">{entry.purchaseInvoice.number}</span>
              </div>
            )}
            {Number(entry.claimAmount) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Claim amount</span>
                <span className="tabular">{entry.claimAmount}</span>
              </div>
            )}
            {entry.claimReference && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Claim reference</div>
                <p className="text-sm">{entry.claimReference}</p>
              </div>
            )}
            {entry.resolutionNote && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Resolution note</div>
                <p className="text-sm">{entry.resolutionNote}</p>
              </div>
            )}
            <div className="space-y-1">
              <div className="text-muted-foreground">Reported items</div>
              <ul className="space-y-1">
                {entry.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-xs">
                    <span>{item.product.name}</span>
                    <span className="tabular">
                      {item.quantity} {item.product.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <DamageResolutionForm
            reportId={entry.id}
            action={resolveDamageReportAction}
            rejectAction={rejectDamageReportAction}
            suppliers={entry.suppliers}
            grns={entry.grns}
            purchaseInvoices={entry.purchaseInvoices}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
