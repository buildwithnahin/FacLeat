import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { CategoryForm } from '../category-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit category' };

interface CategoryDetail {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
}

interface CategoryFlat {
  id: string;
  name: string;
}

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSession();
  const [cat, parents] = await Promise.all([
    backendFetch<CategoryDetail>(`/api/mobile/inventory/categories/${id}`),
    backendFetch<CategoryFlat[]>('/api/mobile/inventory/categories?flat=true'),
  ]);
  return (
    <div>
      <PageHeader title={cat.name} description={cat.description ?? 'Edit category.'} />
      <CategoryForm
        mode="edit"
        initial={{ id: cat.id, name: cat.name, description: cat.description, parentId: cat.parentId }}
        parents={parents}
      />
    </div>
  );
}
