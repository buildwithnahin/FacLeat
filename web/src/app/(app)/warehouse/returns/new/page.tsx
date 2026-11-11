import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { createCustomerReturnAction } from '@/server/actions/warehouse-workflows';
import { PageHeader } from '@/components/shared/page-header';
import { ReturnIntakeForm } from '@/components/shared/return-intake-form';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Customer Return' };

interface SourceDoc {
  value: string;
  label: string;
}

interface IntakeContext {
  warehouses: { id: string; name: string; code: string }[];
  quarantineWarehouse: { id: string; name: string; code: string } | null;
  products: { id: string; sku: string; barcode: string | null; name: string; unit: string }[];
  sourceDocuments: {
    POS: SourceDoc[];
    WHOLESALE: SourceDoc[];
    CORPORATE: SourceDoc[];
    ECOMMERCE: SourceDoc[];
  };
}

export default async function NewCustomerReturnPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId;
  if (!branchId) {
    return (
      <div>
        <PageHeader title="New Customer Return" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch from the topbar first.
        </Card>
      </div>
    );
  }

  const context = await backendFetch<IntakeContext>(
    `/api/mobile/warehouse/returns/intake-context?branchId=${branchId}`,
  );

  if (!context.quarantineWarehouse) {
    return (
      <div>
        <PageHeader title="New Customer Return" />
        <Card className="p-6 text-sm text-muted-foreground">
          Create an active `QUARANTINE` warehouse on this branch before using return inspection.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Customer Return"
        description="Receive returned items into inspection, then route them after QC."
      />
      <ReturnIntakeForm
        branchId={branchId}
        warehouses={context.warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name, code: warehouse.code }))}
        products={context.products.map((product) => ({
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit,
        }))}
        sourceDocuments={context.sourceDocuments}
        action={createCustomerReturnAction}
      />
    </div>
  );
}
