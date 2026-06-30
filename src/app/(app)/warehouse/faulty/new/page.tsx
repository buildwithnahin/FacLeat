import { getSession } from '@/server/auth/session';
import { warehouseService } from '@/server/services/warehouse.service';
import { prisma } from '@/server/db';
import { createDamageReportAction } from '@/server/actions/warehouse-workflows';
import { PageHeader } from '@/components/shared/page-header';
import { DamageReportForm } from '@/components/shared/damage-report-form';
import { Card } from '@/components/ui/card';

export const metadata = { title: 'New Damage Report' };

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

  const [warehouses, quarantine, products] = await Promise.all([
    warehouseService.listActiveForBranch(session, branchId),
    prisma.warehouse.findFirst({ where: { branchId, type: 'QUARANTINE', isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, barcode: true, name: true, unit: true, costPrice: true },
    }),
  ]);

  if (!quarantine) {
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
        warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name, code: warehouse.code }))}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit,
          costPrice: product.costPrice.toString(),
        }))}
        action={createDamageReportAction}
      />
    </div>
  );
}
