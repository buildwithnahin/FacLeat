import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { PhysicalCountForm } from '@/components/shared/physical-count-form';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Physical stock count' };

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface ProductOption {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
}

interface BalanceRow {
  productId: string;
  warehouseId: string;
  balance: string;
}

export default async function CountPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
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
    backendFetch<WarehouseOption[]>(`/api/mobile/warehouse/warehouses?branchId=${branchId}&activeOnly=true`),
    backendFetch<ProductOption[]>('/api/mobile/inventory/products?activeOnly=true'),
    backendFetch<BalanceRow[]>(`/api/mobile/warehouse/stock/balance?branchId=${branchId}`),
  ]);

  // Index balances per warehouse so the form can show the correct "System" qty
  // for whichever warehouse the user has selected, not just the first one.
  const balanceByWarehouseProduct: Record<string, Record<string, string>> = {};
  for (const b of balances) {
    const forWarehouse = (balanceByWarehouseProduct[b.warehouseId] ??= {});
    forWarehouse[b.productId] = b.balance;
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
        products={products.map((p) => ({ id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, unit: p.unit }))}
        balanceByWarehouseProduct={balanceByWarehouseProduct}
      />
    </div>
  );
}
