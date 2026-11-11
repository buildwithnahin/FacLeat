import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { AssetForm } from '../asset-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New asset' };

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Category {
  id: string;
  name: string;
}

export default async function NewAssetPage() {
  const [branches, categories] = await Promise.all([
    backendFetch<Branch[]>('/api/mobile/branches'),
    backendFetch<Category[]>('/api/mobile/assets/categories'),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Add Asset" description="Register a new fixed asset" />
      <AssetForm mode="create" branches={branches} categories={categories} />
    </div>
  );
}
