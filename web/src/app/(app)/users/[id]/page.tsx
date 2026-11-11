import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { UserForm } from '../user-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit user' };

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

interface UserDetail {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  defaultBranchId: string | null;
  branchAccessType: 'ALL_BRANCHES' | 'ASSIGNED_BRANCHES' | 'OWN_BRANCH_ONLY';
  branchAccesses: { branchId: string }[];
  roles: { role: { id: string; name: string } }[];
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let user: UserDetail;
  try {
    user = await backendFetch<UserDetail>(`/api/mobile/users/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const [roles, branches, employees] = await Promise.all([
    backendFetch<RoleOption[]>('/api/mobile/roles'),
    backendFetch<BranchOption[]>('/api/mobile/branches?full=1'),
    backendFetch<EmployeeOption[]>(`/api/mobile/users/employees-lookup?excludeUserId=${id}`),
  ]);

  return (
    <div>
      <PageHeader title={user.name} description={user.email} />
      <UserForm
        mode="edit"
        initial={{
          id: user.id,
          employeeId: user.employeeId,
          email: user.email,
          status: user.status,
          defaultBranchId: user.defaultBranchId,
          branchAccessType: user.branchAccessType,
          assignedBranchIds: user.branchAccesses.map((access) => access.branchId),
          roleId: user.roles[0]?.role.id ?? null,
        }}
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
