import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '../_components/employee-form';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_EMPLOYMENT_TYPES,
  ERP_ROLE_NAMES,
} from '@/server/validators/hr';

export const metadata = { title: 'New employee' };

export default async function NewEmployeePage() {
  const session = await getSession();
  await authorize(session, 'hr:write');
  const [branches, masterRows, managers, roles] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.hrMasterData.findMany({
      where: { type: { in: ['departments', 'designations', 'employment-types'] }, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { type: true, name: true },
    }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, firstName: true, lastName: true, designation: true },
    }),
    prisma.role.findMany({
      where: { name: { in: [...ERP_ROLE_NAMES] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const valuesFor = (type: string, fallback: readonly string[]) => {
    const values = masterRows.filter((row) => row.type === type).map((row) => row.name);
    return values.length ? values : [...fallback];
  };
  return (
    <div>
      <PageHeader title="New employee" description="Create an employee profile with salary structure." />
      <EmployeeForm
        mode="create"
        branches={branches}
        departments={valuesFor('departments', DEFAULT_DEPARTMENTS)}
        designations={valuesFor('designations', DEFAULT_DESIGNATIONS)}
        employmentTypes={valuesFor('employment-types', DEFAULT_EMPLOYMENT_TYPES)}
        managers={managers.map((m) => ({
          id: m.id,
          label: `${m.code} · ${m.firstName} ${m.lastName}${m.designation ? ` · ${m.designation}` : ''}`,
        }))}
        roles={roles}
      />
    </div>
  );
}
