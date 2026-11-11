import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { ProductionOrderForm } from '../production-order-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New production order' };

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  type: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  branchId: string;
}

interface Prefill {
  planId: string;
  planNo: string;
  branchId: string;
  productId: string;
  plannedQty: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

export default async function NewProductionOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const sp = await searchParams;

  const qs = new URLSearchParams();
  if (sp.planId) qs.set('planId', sp.planId);

  const { branches, products, warehouses, prefill } = await backendFetch<{
    branches: Branch[];
    products: Product[];
    warehouses: Warehouse[];
    prefill: Prefill | null;
  }>(`/api/mobile/factory/new-form-data?${qs.toString()}`);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="New Production Order"
        description={
          prefill ? `From plan ${prefill.planNo}` : 'Plan a production run — set target output, materials, and stages'
        }
      />
      <ProductionOrderForm
        branches={branches}
        products={products}
        warehouses={warehouses}
        prefill={prefill ?? undefined}
      />
    </div>
  );
}
