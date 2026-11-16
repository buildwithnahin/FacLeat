import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { WarehouseForm } from '../warehouse-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New warehouse' };

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewWarehousePage() {
  const session = await getSession();
  const branches = await backendFetch<BranchOption[]>('/api/mobile/branches?activeOnly=true');
  const activeBranchId = session?.activeBranchId ?? null;
  const activeBranch = activeBranchId ? branches.find((b) => b.id === activeBranchId) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader title="New warehouse" description="Add a stock location under a branch." />
      <WarehouseForm
        mode="create"
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
        activeBranchId={activeBranchId}
        activeBranchName={activeBranch ? `${activeBranch.name} (${activeBranch.code})` : null}
      />
    </div>
  );
}
