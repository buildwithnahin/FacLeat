import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { warehouseService } from '@/server/services/warehouse.service';
import { prisma } from '@/server/db';
import { StockRequisitionForm } from '../requisition-form';

export const metadata = { title: 'New Stock Requisition' };

export default async function NewStockRequisitionPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? session?.defaultBranchId;

  if (!branchId) {
    return (
      <div className="space-y-6">
        <PageHeader title="New stock requisition" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch before creating a showroom requisition.
        </Card>
      </div>
    );
  }

  const [showrooms, products] = await Promise.all([
    warehouseService.listActiveShowroomsForBranch(session, branchId),
    prisma.product.findMany({
      where: { isActive: true, type: 'FINISHED_GOOD' },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true, unit: true },
    }),
  ]);

  if (showrooms.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="New stock requisition" />
        <Card className="p-6 text-sm text-muted-foreground">
          Create at least one active showroom warehouse on this branch before submitting showroom requisitions.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Showroom Product Requisition"
        description="Submit a showroom request for finished goods. Stock is finalized only after receipt confirmation."
      />
      <StockRequisitionForm
        branchId={branchId}
        showrooms={showrooms.map((warehouse) => ({
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
        }))}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
        }))}
      />
    </div>
  );
}
