import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { buildDesignationOptions } from '@/lib/hr-master-data';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '../_components/employee-form';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_EMPLOYMENT_TYPES,
  ERP_ROLE_NAMES,
} from '@/server/validators/hr';

export const metadata = { title: 'New employee' };

export default async function NewEmployeePage() {
  const session = await getSession();
  await authorize(session, 'hr:write');
  const [branches, masterRows, managers, roles, shifts] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.hrMasterData.findMany({
      where: { type: { in: ['departments', 'designations'] }, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { type: true, name: true, metadata: true },
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
    prisma.shift.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true, code: true, branch: { select: { code: true, name: true } } },
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
        designationOptions={buildDesignationOptions(
          masterRows.filter((row) => row.type === 'designations').map((row) => ({ name: row.name, metadata: row.metadata })),
        )}
        employmentTypes={[...DEFAULT_EMPLOYMENT_TYPES]}
        shifts={shifts.map((shift) => ({
          id: shift.id,
          label: `${shift.code} · ${shift.name} · ${shift.branch.code}`,
        }))}
        managers={managers.map((m) => ({
          id: m.id,
          label: `${m.code} · ${m.firstName} ${m.lastName}${m.designation ? ` · ${m.designation}` : ''}`,
        }))}
        roles={roles}
      />
    </div>
  );
}
