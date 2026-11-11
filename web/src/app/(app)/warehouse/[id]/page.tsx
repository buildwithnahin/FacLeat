import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { WarehouseForm } from '../warehouse-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit warehouse' };

interface WarehouseDetail {
  id: string;
  branchId: string;
  code: string;
  name: string;
  type: 'MAIN' | 'STORE' | 'WIP' | 'QUARANTINE' | 'DAMAGED' | 'SHOWROOM';
  address: string | null;
  isActive: boolean;
  branch: { name: string };
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSession();
  const [wh, branches] = await Promise.all([
    backendFetch<WarehouseDetail>(`/api/mobile/warehouse/warehouses/${id}`),
    backendFetch<BranchOption[]>('/api/mobile/branches?activeOnly=true'),
  ]);
  return (
    <div>
      <PageHeader title={wh.name} description={`${wh.branch.name} · ${wh.code}`} />
      <WarehouseForm
        mode="edit"
        initial={{
          id: wh.id,
          branchId: wh.branchId,
          code: wh.code,
          name: wh.name,
          type: wh.type,
          address: wh.address,
          isActive: wh.isActive,
        }}
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
      />
    </div>
  );
}
