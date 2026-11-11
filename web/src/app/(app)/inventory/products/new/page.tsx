import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ProductForm } from '../product-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New product' };

interface CategoryFlat {
  id: string;
  name: string;
}

interface BrandOption {
  id: string;
  name: string;
}

export default async function NewProductPage() {
  await getSession();
  const [categories, brands] = await Promise.all([
    backendFetch<CategoryFlat[]>('/api/mobile/inventory/categories?flat=true'),
    backendFetch<BrandOption[]>('/api/mobile/inventory/brands'),
  ]);

  return (
    <div>
      <PageHeader title="New product" description="Create a new SKU." />
      <ProductForm mode="create" categories={categories} brands={brands} />
    </div>
  );
}
