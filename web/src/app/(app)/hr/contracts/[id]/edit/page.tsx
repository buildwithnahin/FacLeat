import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ContractForm } from '../../contract-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit Contract' };

interface BranchRow {
  id: string;
  code: string;
  name: string;
}

interface ShiftRow {
  id: string;
  code: string;
  name: string;
}

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  branchId: string;
  branchName: string | null;
  department: string | null;
  designation: string | null;
  shiftId: string | null;
  shiftName: string | null;
  basicSalary: string;
  houseAllowance: string;
  transportAllowance: string;
  medicalAllowance: string;
  otherAllowance: string;
}

interface ContractDetail {
  id: string;
  contractNo: string;
  employeeId: string | null;
  candidateId: string | null;
  offerId: string | null;
  candidateName: string | null;
  branchId: string | null;
  department: string | null;
  designation: string | null;
  contractType: string;
  startDate: string;
  endDate: string | null;
  basicSalary: string;
  allowances: string;
  shiftId: string | null;
  weeklyOff: string;
  status: string;
  attachmentUrl: string | null;
  notes: string | null;
  employee: { firstName: string; lastName: string } | null;
}

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSession();

  let contract: ContractDetail;
  try {
    contract = await backendFetch<ContractDetail>(`/api/mobile/hr/contracts/${id}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    throw err;
  }

  const [branches, shifts, employees] = await Promise.all([
    backendFetch<BranchRow[]>('/api/mobile/branches?activeOnly=true'),
    backendFetch<ShiftRow[]>('/api/mobile/hr/shifts'),
    backendFetch<EmployeeRow[]>('/api/mobile/hr/employees?status=ACTIVE'),
  ]);

  const mappedEmployees = employees.map((emp) => ({
    id: emp.id,
    code: emp.code,
    firstName: emp.firstName,
    lastName: emp.lastName,
    branchId: emp.branchId,
    branchName: emp.branchName ?? '',
    department: emp.department,
    designation: emp.designation,
    shiftId: emp.shiftId,
    shiftName: emp.shiftName,
    basicSalary: Number(emp.basicSalary),
    allowances:
      Number(emp.houseAllowance) + Number(emp.transportAllowance) + Number(emp.medicalAllowance) + Number(emp.otherAllowance),
  }));

  const initialData = {
    id: contract.id,
    contractNo: contract.contractNo,
    employeeId: contract.employeeId,
    candidateId: contract.candidateId,
    offerId: contract.offerId,
    candidateName: contract.candidateName,
    branchId: contract.branchId,
    department: contract.department,
    designation: contract.designation,
    contractType: contract.contractType,
    startDate: new Date(contract.startDate).toISOString().slice(0, 10),
    endDate: contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : null,
    basicSalary: contract.basicSalary,
    allowances: contract.allowances,
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
        description={`Update terms for Contract ${contract.contractNo} associated with ${contract.employee ? `${contract.employee.firstName} ${contract.employee.lastName}` : 'the assigned employee'}.`}
      />
      <ContractForm
        mode="edit"
        scope="employee"
        branches={branches}
        shifts={shifts}
        employees={mappedEmployees}
        initial={initialData}
      />
    </div>
  );
}
