import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { contractsService } from '@/server/services/contracts.service';
import { PageHeader } from '@/components/shared/page-header';
import { ContractForm } from '../../contract-form';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Edit Contract' };

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:write');

  let contract;
  try {
    contract = await contractsService.getById(session, id);
  } catch {
    notFound();
  }

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

  const initialData = {
    id: contract.id,
    contractNo: contract.contractNo,
    employeeId: contract.employeeId,
    branchId: contract.branchId,
    department: contract.department,
    designation: contract.designation,
    contractType: contract.contractType,
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
    basicSalary: contract.basicSalary.toString(),
    allowances: contract.allowances.toString(),
    shiftId: contract.shiftId,
    weeklyOff: contract.weeklyOff,
    status: contract.status,
    attachmentUrl: contract.attachmentUrl,
    notes: contract.notes,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Employee Contract"
        description={`Update terms for Contract ${contract.contractNo} associated with ${contract.employee.firstName} ${contract.employee.lastName}.`}
      />
      <ContractForm
        mode="edit"
        branches={branches}
        shifts={shifts}
        employees={mappedEmployees}
        initial={initialData}
      />
    </div>
  );
}
