import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import { NotFoundError } from '@/lib/errors';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '../../_components/employee-form';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_EMPLOYMENT_TYPES,
  ERP_ROLE_NAMES,
} from '@/server/validators/hr';

export const metadata = { title: 'Edit Employee' };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:write');

  let employee;
  try {
    employee = await hrService.getEmployee(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [branches, masterRows, managers, roles, shifts] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.hrMasterData.findMany({
      where: { type: { in: ['departments', 'designations'] }, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { type: true, name: true },
    }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE', id: { not: id } },
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
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${employee.firstName} ${employee.lastName}`}
        description="Update employee master data, salary structure, and payroll details."
      />
      <EmployeeForm
        mode="edit"
        branches={branches}
        initial={{
          id: employee.id,
          branchId: employee.branchId,
          code: employee.code,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          designation: employee.designation,
          department: employee.department,
          employmentType: employee.employmentType,
          shiftId: employee.shiftId,
          reportingManagerId: employee.reportingManagerId,
          systemRoleId: employee.systemRoleId,
          joinedAt: employee.joinedAt.toISOString().slice(0, 10),
          status: employee.status,
          basicSalary: employee.basicSalary.toString(),
          houseAllowance: employee.houseAllowance.toString(),
          transportAllowance: employee.transportAllowance.toString(),
          medicalAllowance: employee.medicalAllowance.toString(),
          otherAllowance: employee.otherAllowance.toString(),
          providentFund: employee.providentFund.toString(),
          taxDeduction: employee.taxDeduction.toString(),
          bankName: employee.bankName,
          bankAccount: employee.bankAccount,
        }}
        departments={valuesFor('departments', DEFAULT_DEPARTMENTS)}
        designations={valuesFor('designations', DEFAULT_DESIGNATIONS)}
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
