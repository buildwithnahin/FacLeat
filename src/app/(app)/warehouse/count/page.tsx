import { getSession } from '@/server/auth/session';
import { warehouseService } from '@/server/services/warehouse.service';
import { stockService } from '@/server/services/stock.service';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { PhysicalCountForm } from '@/components/shared/physical-count-form';
import { Card } from '@/components/ui/card';

export const metadata = { title: 'Physical stock count' };

export default async function CountPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId;
  if (!branchId) {
    return (
      <div>
        <PageHeader title="Physical stock count" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch from the topbar first.
        </Card>
      </div>
    );
  }

  const [warehouses, products, balances] = await Promise.all([
    warehouseService.listActiveForBranch(session, branchId),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, barcode: true, name: true, unit: true },
    }),
    stockService.balanceSnapshot(session, branchId),
  ]);

  // Index balances per warehouse so the form can show the correct "System" qty
  // for whichever warehouse the user has selected, not just the first one.
  const balanceByWarehouseProduct: Record<string, Record<string, string>> = {};
  for (const b of balances) {
    const forWarehouse = (balanceByWarehouseProduct[b.warehouseId] ??= {});
    forWarehouse[b.productId] = b.balance.toString();
  }

  return (
    <div>
      <PageHeader
        title="Physical stock count"
        description="Scan items, enter counted quantities, and let the system post variance adjustments."
      />
      <PhysicalCountForm
        branchId={branchId}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
        products={products}
        balanceByWarehouseProduct={balanceByWarehouseProduct}
      />
    </div>
  );
}
