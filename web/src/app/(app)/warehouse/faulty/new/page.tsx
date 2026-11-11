import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { createDamageReportAction } from '@/server/actions/warehouse-workflows';
import { PageHeader } from '@/components/shared/page-header';
import { DamageReportForm } from '@/components/shared/damage-report-form';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Damage Report' };

interface IntakeContext {
  warehouses: { id: string; name: string; code: string }[];
  quarantineWarehouse: { id: string; name: string; code: string } | null;
  products: { id: string; sku: string; barcode: string | null; name: string; unit: string; costPrice: string }[];
}

export default async function NewDamageReportPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId;
  if (!branchId) {
    return (
      <div>
        <PageHeader title="New Damage Report" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch from the topbar first.
        </Card>
      </div>
    );
  }

  const context = await backendFetch<IntakeContext>(
    `/api/mobile/warehouse/damage-reports/intake-context?branchId=${branchId}`,
  );

  if (!context.quarantineWarehouse) {
    return (
      <div>
        <PageHeader title="New Damage Report" />
        <Card className="p-6 text-sm text-muted-foreground">
          Create an active `QUARANTINE` warehouse on this branch before using faulty stock reporting.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Damage Report"
        description="Move damaged items from normal stock into quarantine, then resolve them after approval if needed."
      />
      <DamageReportForm
        branchId={branchId}
        warehouses={context.warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name, code: warehouse.code }))}
        products={context.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit,
          costPrice: product.costPrice,
        }))}
        action={createDamageReportAction}
      />
    </div>
  );
}
