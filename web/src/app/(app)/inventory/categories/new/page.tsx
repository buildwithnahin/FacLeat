import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { CategoryForm } from '../category-form';
import type { CategoryTypeDto } from '../create-type-dialog';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New category' };

interface CategoryFlat {
  id: string;
  name: string;
}

export default async function NewCategoryPage() {
  await getSession();
  const [parents, types] = await Promise.all([
    backendFetch<CategoryFlat[]>('/api/mobile/inventory/categories?flat=true'),
    backendFetch<CategoryTypeDto[]>('/api/mobile/inventory/categories/types').catch(() => [] as CategoryTypeDto[]),
  ]);

  return (
    <div>
      <PageHeader title="New category" description="Create a product category." />
      <CategoryForm mode="create" parents={parents} types={types} />
    </div>
  );
}
