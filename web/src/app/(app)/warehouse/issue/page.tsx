import Link from 'next/link';
import { History } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { postIssueAction } from '@/server/actions/stock';
import { PageHeader } from '@/components/shared/page-header';
import { StockMovementForm } from '@/components/shared/stock-movement-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Goods issue' };

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
  type: string;
  costPrice: string;
  sellPrice: string;
}

export default async function IssuePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  if (!branchId) {
    return (
      <div>
        <PageHeader title="Goods issue" />
        <Card className="p-6 text-sm text-muted-foreground">
          No branch access configured for this account.
        </Card>
      </div>
    );
  }

  const [warehouses, products] = await Promise.all([
    backendFetch<WarehouseOption[]>(`/api/mobile/warehouse/warehouses?branchId=${branchId}&activeOnly=true`),
    backendFetch<ProductOption[]>('/api/mobile/inventory/products?activeOnly=true'),
  ]);

  return (
    <div>
      <PageHeader
        title="Goods issue"
        description="Scan or type SKU / barcode to issue items from the warehouse."
      >
        <Button variant="outline" asChild>
          <Link href="/warehouse/issued">
            <History className="h-4 w-4" />
            View issued log
          </Link>
        </Button>
      </PageHeader>
      <StockMovementForm
        mode="issue"
        branchId={branchId}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
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
        action={postIssueAction}
        submitLabel="Post issue"
        showCost={false}
        cancelHref="/warehouse/issued"
      />
    </div>
  );
}
