import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { backendFetch } from '@/lib/backend-client';
import { CategoryManager, type AssetCategoryRow } from './category-manager';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Asset Categories | Annex Leather' };

export default async function AssetCategoriesPage() {
  const categories = await backendFetch<AssetCategoryRow[]>('/api/mobile/assets/categories').catch(
    () => [] as AssetCategoryRow[],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Asset Categories"
          description="Depreciation method defaults, standard asset lifespans, and salvage rates."
        />
        <Button variant="outline" size="sm" asChild>
          <Link href="/assets" className="gap-1.5 text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Assets
          </Link>
        </Button>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
