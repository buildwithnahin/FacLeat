import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ContractForm } from '../contract-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Contract' };

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

export default async function NewContractPage() {
  await getSession();

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Employee Contract"
        description="Draft and register a new employment agreement. Default payroll and department details will be loaded from the employee profile."
      />
      <ContractForm
        mode="create"
        scope="employee"
        branches={branches}
        shifts={shifts}
        employees={mappedEmployees}
      />
    </div>
  );
}
