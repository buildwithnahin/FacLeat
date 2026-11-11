import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { UserForm } from '../user-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New user' };

// Kept in sync with the root ERP_ROLE_NAMES list (src/server/validators/hr.ts)
// — that file also pulls in HR's Prisma-backed schemas, which aren't part of
// this module's migration, so the plain name list is inlined here instead.
const ERP_ROLE_NAMES = [
  'Super Admin',
  'Admin',
  'HR',
  'Accounts',
  'Commercial',
  'Inventory',
  'Production',
  'Purchase',
  'Store',
  'Sales',
  'Management',
] as const;

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface EmployeeOption {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  department: string | null;
}

export default async function NewUserPage() {
  const [roles, branches, employees] = await Promise.all([
    backendFetch<RoleOption[]>('/api/mobile/roles'),
    backendFetch<BranchOption[]>('/api/mobile/branches?full=1'),
    backendFetch<EmployeeOption[]>('/api/mobile/users/employees-lookup'),
  ]);

  return (
    <div>
      <PageHeader title="New user" description="Create a system user." />
      <UserForm
        mode="create"
        roles={roles
          .filter((r) => (ERP_ROLE_NAMES as readonly string[]).includes(r.name))
          .map((r) => ({ id: r.id, name: r.name, description: r.description }))}
        branches={branches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, code: b.code }))}
        employees={employees.map((e) => ({
          id: e.id,
          label: `${e.code} · ${e.firstName} ${e.lastName} · ${e.designation ?? 'No designation'} · ${e.department ?? 'No department'}`,
        }))}
      />
    </div>
  );
}
