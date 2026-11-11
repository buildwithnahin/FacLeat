import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { RoleForm } from '../role-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit role' };

interface PermissionOption {
  key: string;
  module: string;
  action: string;
}

interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { key: string } }[];
}

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let role: RoleDetail;
  try {
    role = await backendFetch<RoleDetail>(`/api/mobile/roles/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const permissions = await backendFetch<PermissionOption[]>('/api/mobile/permissions');

  return (
    <div>
      <PageHeader title={role.name} description={role.description ?? 'Edit role and permissions.'} />
      <RoleForm
        mode="edit"
        initial={{
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissionKeys: role.permissions.map((rp) => rp.permission.key),
        }}
        permissions={permissions}
      />
    </div>
  );
}
