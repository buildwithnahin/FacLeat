import { getSession } from '@/server/auth/session';
import { userService } from '@/server/services/user.service';
import { roleService } from '@/server/services/role.service';
import { branchService } from '@/server/services/branch.service';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { UserForm } from '../user-form';
import { ERP_ROLE_NAMES } from '@/server/validators/hr';

export const metadata = { title: 'Edit user' };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const [user, roles, branches, employees] = await Promise.all([
    userService.getById(session, id),
    roleService.list(session),
    branchService.listActive(session),
    prisma.employee.findMany({
      where: { status: 'ACTIVE', OR: [{ user: null }, { user: { id } }] },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, firstName: true, lastName: true, designation: true, department: true },
    }),
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
          roleId: user.roles[0]?.role.id ?? null,
        }}
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
