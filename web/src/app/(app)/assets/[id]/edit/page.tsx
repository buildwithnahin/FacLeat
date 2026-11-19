import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { AssetForm } from '../../asset-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit asset' };

interface AssetDetail {
  id: string;
  code: string;
  name: string;
  branchId: string;
  categoryId: string | null;
  description: string | null;
  serialNumber: string | null;
  location: string | null;
  assignedTo: string | null;
  condition: string;
  status: string;
  purchaseDate: string;
  purchaseCost: string;
  salvageValue: string;
  usefulLifeMonths: number;
  depreciationMethod: string;
  notes: string | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Category {
  id: string;
  name: string;
  depreciationMethod?: string;
  defaultLifeMonths?: number;
  defaultSalvageRate?: string | number;
}

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let asset: AssetDetail;
  try {
    asset = await backendFetch<AssetDetail>(`/api/mobile/assets/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const [branches, categories] = await Promise.all([
    backendFetch<Branch[]>('/api/mobile/branches'),
    backendFetch<Category[]>('/api/mobile/assets/categories'),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={`Edit ${asset.code}`} description={asset.name} />
      <AssetForm
        mode="edit"
        branches={branches}
        categories={categories}
        defaults={{
          id: asset.id,
          branchId: asset.branchId,
          categoryId: asset.categoryId,
          name: asset.name,
          description: asset.description,
          serialNumber: asset.serialNumber,
          location: asset.location,
          assignedTo: asset.assignedTo,
          condition: asset.condition,
          status: asset.status,
          purchaseDate: new Date(asset.purchaseDate).toISOString().slice(0, 10),
          purchaseCost: asset.purchaseCost,
          salvageValue: asset.salvageValue,
          usefulLifeMonths: asset.usefulLifeMonths,
          depreciationMethod: asset.depreciationMethod,
          notes: asset.notes,
        }}
      />
    </div>
  );
}
