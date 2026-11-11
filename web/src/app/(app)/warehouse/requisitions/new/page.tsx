import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { StockRequisitionForm } from '../requisition-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Stock Requisition' };

interface NewContext {
  showrooms: { id: string; name: string; code: string }[];
  products: { id: string; sku: string; name: string; unit: string }[];
}

export default async function NewStockRequisitionPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];

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

  const context = await backendFetch<NewContext>(
    `/api/mobile/warehouse/requisitions/new-context?branchId=${branchId}`,
  );

  if (context.showrooms.length === 0) {
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
        showrooms={context.showrooms.map((warehouse) => ({
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
        }))}
        products={context.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
        }))}
      />
    </div>
  );
}
