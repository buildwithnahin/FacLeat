import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { postTransferAction } from '@/server/actions/stock';
import { PageHeader } from '@/components/shared/page-header';
import { StockMovementForm } from '@/components/shared/stock-movement-form';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stock transfer' };

interface WarehouseRecord {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive: boolean;
  branchId: string;
  branch: { name: string; code: string };
}

interface ProductOption {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  type: string;
  costPrice: string;
  sellPrice: string;
}

export default async function TransferPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];

  const [allWarehouses, products] = await Promise.all([
    backendFetch<WarehouseRecord[]>('/api/mobile/warehouse/warehouses'),
    backendFetch<ProductOption[]>('/api/mobile/inventory/products?activeOnly=true'),
  ]);

  const warehouses = allWarehouses.filter((w) => w.isActive);

  if (warehouses.length < 2) {
    return (
      <div>
        <PageHeader title="Stock transfer" />
        <Card className="p-6 text-sm text-muted-foreground">
          You need at least two active warehouses to perform a stock transfer.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Stock transfer"
        description="Move stock between warehouses within the same branch or across branches."
      />
      <StockMovementForm
        mode="transfer"
        branchId={branchId ?? warehouses[0]!.branchId}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          name: w.type ? `${w.name} [${w.type}]` : w.name,
          code: w.code,
          branchName: w.branch?.name,
          branchCode: w.branch?.code,
        }))}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          unit: p.unit,
          type: p.type,
          costPrice: p.costPrice,
          sellPrice: p.sellPrice,
        }))}
        action={postTransferAction}
        submitLabel="Post transfer"
        showCost={true}
        cancelHref="/warehouse"
      />
    </div>
  );
}
