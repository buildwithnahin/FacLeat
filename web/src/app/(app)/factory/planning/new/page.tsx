import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { ProductionPlanForm } from '../plan-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New production plan' };

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
}

export default async function NewProductionPlanPage() {
  const { branches, products } = await backendFetch<{ branches: Branch[]; products: Product[] }>(
    '/api/mobile/factory/planning/new-form-data',
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="New Production Plan"
        description="Plan a run ahead of committing to a production order"
      />
      <ProductionPlanForm branches={branches} products={products} />
    </div>
  );
}
