import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { BranchForm } from '../branch-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit branch' };

interface BranchDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: 'BDT' | 'INR' | 'USD' | 'EUR';
  address: string | null;
  phone: string | null;
  email: string | null;
  allowNegativeStock: boolean;
  isActive: boolean;
}

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let branch: BranchDetail;
  try {
    branch = await backendFetch<BranchDetail>(`/api/mobile/branches/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <PageHeader title={branch.name} description={`${branch.code} · ${branch.currency}`} />
      <BranchForm
        mode="edit"
        initial={{
          id: branch.id,
          code: branch.code,
          name: branch.name,
          type: branch.type,
          currency: branch.currency,
          address: branch.address,
          phone: branch.phone,
          email: branch.email,
          allowNegativeStock: branch.allowNegativeStock,
          isActive: branch.isActive,
        }}
      />
    </div>
  );
}
