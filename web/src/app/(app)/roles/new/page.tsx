import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { RoleForm } from '../role-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New role' };

interface PermissionOption {
  key: string;
  module: string;
  action: string;
}

export default async function NewRolePage() {
  const permissions = await backendFetch<PermissionOption[]>('/api/mobile/permissions');
  return (
    <div>
      <PageHeader title="New role" description="Define a new role and choose its permissions." />
      <RoleForm mode="create" permissions={permissions} />
    </div>
  );
}
