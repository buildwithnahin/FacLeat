import { getSession } from '@/server/auth/session';
import { warehouseService } from '@/server/services/warehouse.service';
import { prisma } from '@/server/db';
import { postTransferAction } from '@/server/actions/stock';
import { PageHeader } from '@/components/shared/page-header';
import { StockMovementForm } from '@/components/shared/stock-movement-form';
import { Card } from '@/components/ui/card';

export const metadata = { title: 'Stock transfer' };

export default async function TransferPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId;

  const [warehouses, products] = await Promise.all([
    warehouseService.listActiveShowrooms(session),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        unit: true,
        type: true,
        costPrice: true,
        sellPrice: true,
      },
    }),
  ]);

  const uniqueBranchCount = new Set(warehouses.map((warehouse) => warehouse.branchId)).size;

  if (warehouses.length < 2 || uniqueBranchCount < 2) {
    return (
      <div>
        <PageHeader title="Stock transfer" />
        <Card className="p-6 text-sm text-muted-foreground">
          You need active showroom warehouses in at least two different branches to transfer stock.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Stock transfer"
        description="Move stock between showroom warehouses in different branches."
      />
      <StockMovementForm
        mode="transfer"
        branchId={branchId ?? session?.defaultBranchId ?? warehouses[0]!.branchId}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          name: w.name,
          code: w.code,
          branchName: w.branch.name,
          branchCode: w.branch.code,
        }))}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          unit: p.unit,
          type: p.type,
          costPrice: p.costPrice.toString(),
          sellPrice: p.sellPrice.toString(),
        }))}
        action={postTransferAction}
        submitLabel="Post transfer"
        showCost={false}
      />
    </div>
  );
}
