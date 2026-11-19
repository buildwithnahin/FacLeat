import { PageHeader } from '@/components/shared/page-header';
import { RequisitionForm } from '../_components/requisition-form';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Purchase Requisition' };

interface PurchaseLookups {
  branches: { id: string; name: string; code: string; currency: string }[];
  products: { id: string; sku: string; name: string; unit: string; costPrice?: string }[];
}

export default async function NewRequisitionPage() {
  const session = await getSession();
  const defaultBranchId =
    session?.activeBranchId ?? session?.defaultBranchId ?? session?.allowedBranchIds?.[0];
  const { branches, products } = await backendFetch<PurchaseLookups>(
    `/api/mobile/purchase/lookups${defaultBranchId ? `?branchId=${defaultBranchId}` : ''}`,
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Create Purchase Requisition"
        description="Raise a PR for approval before converting it to a PO"
      />
      <RequisitionForm
        branches={branches}
        defaultBranchId={defaultBranchId}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          costPrice: product.costPrice,
        }))}
      />
    </div>
  );
}
