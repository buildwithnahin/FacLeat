import { PageHeader } from '@/components/shared/page-header';
import { POForm } from '../_components/po-form';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Purchase Order' };

interface PurchaseLookups {
  branches: { id: string; name: string; code: string; currency: string }[];
  products: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    size: string | null;
    costPrice: string;
    categoryName: string | null;
  }[];
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
  currency: string;
}

interface RequisitionDetail {
  id: string;
  number: string;
  status: string;
  branchId: string;
  items: {
    productId?: string | null;
    productName: string;
    unit: string;
    quantity: string;
    estimatedPrice?: string;
  }[];
}

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ requisitionId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const defaultBranchId =
    session?.activeBranchId ?? session?.defaultBranchId ?? session?.allowedBranchIds?.[0];
  const [{ branches, products }, suppliers, requisition] = await Promise.all([
    backendFetch<PurchaseLookups>(
      `/api/mobile/purchase/lookups${defaultBranchId ? `?branchId=${defaultBranchId}` : ''}`,
    ),
    backendFetch<SupplierOption[]>('/api/mobile/suppliers?status=ACTIVE'),
    sp.requisitionId
      ? backendFetch<RequisitionDetail>(`/api/mobile/purchase/requisitions/${sp.requisitionId}`).catch(
          (e) => {
            if (e instanceof BackendApiError && e.status === 404) return null;
            throw e;
          },
        )
      : Promise.resolve(null),
  ]);

  const prefill =
    requisition && requisition.status === 'APPROVED'
      ? {
          requisitionId: requisition.id,
          branchId: requisition.branchId,
          items: requisition.items.map((i) => ({
            productId: i.productId ?? undefined,
            productName: i.productName,
            unit: i.unit,
            quantity: i.quantity,
            estimatedPrice: i.estimatedPrice,
          })),
        }
      : undefined;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Create Purchase Order"
        description={
          prefill ? `From requisition ${requisition?.number}` : 'Commit an order with a supplier'
        }
      />
      <POForm
        branches={branches}
        suppliers={suppliers}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          size: p.size,
          categoryName: p.categoryName,
          costPrice: p.costPrice,
        }))}
        prefill={prefill}
        defaultBranchId={defaultBranchId}
      />
    </div>
  );
}
