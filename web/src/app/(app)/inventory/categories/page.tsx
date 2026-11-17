import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { CategoriesView, type CategoryRow } from './categories-view';
import type { CategoryTypeDto } from './create-type-dialog';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Product categories & types' };

interface SearchParams {
  search?: string;
  type?: string;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const [session, sp] = await Promise.all([
    getSession(),
    searchParams ? await searchParams : ({} as SearchParams),
  ]);

  const qs = new URLSearchParams();
  if (sp.type && sp.type !== 'ALL') qs.set('type', sp.type);
  if (sp.search && sp.search.trim()) qs.set('search', sp.search.trim());

  const [categories, types] = await Promise.all([
    backendFetch<CategoryRow[]>(`/api/mobile/inventory/categories${qs.toString() ? `?${qs.toString()}` : ''}`),
    backendFetch<CategoryTypeDto[]>('/api/mobile/inventory/categories/types').catch(() => [] as CategoryTypeDto[]),
  ]);

  const canWrite = session?.permissions.includes('inventory:write') ?? false;

  return (
    <CategoriesView
      categories={categories}
      types={types}
      canWrite={canWrite}
      initialSearch={sp.search ?? ''}
      initialType={sp.type ?? 'ALL'}
    />
  );
}
