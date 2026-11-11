import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { postTransferAction } from '@/server/actions/stock';
import { PageHeader } from '@/components/shared/page-header';
import { StockMovementForm } from '@/components/shared/stock-movement-form';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stock transfer' };

interface ShowroomWarehouse {
  id: string;
  name: string;
  code: string;
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

  const [warehouses, products] = await Promise.all([
    backendFetch<ShowroomWarehouse[]>('/api/mobile/warehouse/warehouses?showrooms=true'),
    backendFetch<ProductOption[]>('/api/mobile/inventory/products?activeOnly=true'),
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
        branchId={branchId ?? warehouses[0]!.branchId}
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
          costPrice: p.costPrice,
          sellPrice: p.sellPrice,
        }))}
        action={postTransferAction}
        submitLabel="Post transfer"
        showCost={false}
        cancelHref="/warehouse"
      />
    </div>
  );
}
