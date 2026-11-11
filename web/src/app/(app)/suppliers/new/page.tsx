import { PageHeader } from '@/components/shared/page-header';
import { SupplierForm } from '../supplier-form';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New supplier' };

interface BranchOption {
  id: string;
  name: string;
  code: string;
  currency: string;
}

export default async function NewSupplierPage() {
  const session = await getSession();
  const { branches } = await backendFetch<{ branches: BranchOption[] }>('/api/mobile/suppliers/lookups');
  const defaultBranchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    branches[0]?.id ??
    '';

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Add New Supplier"
        description="Create a supplier profile for procurement and payables"
      />
      <SupplierForm mode="create" branches={branches} initial={{ branchId: defaultBranchId }} />
    </div>
  );
}
