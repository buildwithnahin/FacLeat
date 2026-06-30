import { getSession } from '@/server/auth/session';
import { roleService } from '@/server/services/role.service';
import { branchService } from '@/server/services/branch.service';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { UserForm } from '../user-form';
import { ERP_ROLE_NAMES } from '@/server/validators/hr';

export const metadata = { title: 'New user' };

export default async function NewUserPage() {
  const session = await getSession();
  const [roles, branches, employees] = await Promise.all([
    roleService.list(session),
    branchService.listActive(session),
    prisma.employee.findMany({
      where: { status: 'ACTIVE', user: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, firstName: true, lastName: true, designation: true, department: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="New user" description="Create a system user." />
      <UserForm
        mode="create"
        roles={roles
          .filter((r) => (ERP_ROLE_NAMES as readonly string[]).includes(r.name))
          .map((r) => ({ id: r.id, name: r.name, description: r.description }))}
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
        employees={employees.map((e) => ({
          id: e.id,
          label: `${e.code} · ${e.firstName} ${e.lastName} · ${e.designation ?? 'No designation'} · ${e.department ?? 'No department'}`,
        }))}
      />
    </div>
  );
}
