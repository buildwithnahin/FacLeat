import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { ContractForm } from '../contract-form';

export const metadata = { title: 'New Contract' };

export default async function NewContractPage() {
  const session = await getSession();
  await authorize(session, 'hr:write');

  const [branches, shifts, employees] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.shift.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        branchId: true,
        branch: { select: { name: true } },
        department: true,
        designation: true,
        shiftId: true,
        shift: { select: { name: true } },
        basicSalary: true,
        houseAllowance: true,
        medicalAllowance: true,
        transportAllowance: true,
        otherAllowance: true,
      },
    }),
  ]);

  const mappedEmployees = employees.map((emp) => ({
    id: emp.id,
    code: emp.code,
    firstName: emp.firstName,
    lastName: emp.lastName,
    branchId: emp.branchId,
    branchName: emp.branch.name,
    department: emp.department,
    designation: emp.designation,
    shiftId: emp.shiftId,
    shiftName: emp.shift?.name || null,
    basicSalary: emp.basicSalary.toNumber(),
    allowances: emp.houseAllowance
      .plus(emp.transportAllowance)
      .plus(emp.medicalAllowance)
      .plus(emp.otherAllowance)
      .toNumber(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Employee Contract"
        description="Draft and register a new employment agreement. Default payroll and department details will be loaded from the employee profile."
      />
      <ContractForm
        mode="create"
        branches={branches}
        shifts={shifts}
        employees={mappedEmployees}
      />
    </div>
  );
}
