import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '../../_components/employee-form';
import { DEFAULT_DEPARTMENTS, DEFAULT_EMPLOYMENT_TYPES, EMPLOYMENT_STATUSES } from '@/server/validators/hr';
import type { DesignationOption } from '@/lib/hr-master-data';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit Employee' };

interface EmployeeDetail {
  id: string;
  branchId: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  employmentType: string | null;
  shiftId: string | null;
  reportingManagerId: string | null;
  systemRoleId: string | null;
  joinedAt: string;
  status: (typeof EMPLOYMENT_STATUSES)[number];
  basicSalary: string;
  houseAllowance: string;
  transportAllowance: string;
  medicalAllowance: string;
  otherAllowance: string;
  providentFund: string;
  taxDeduction: string;
  bankName: string | null;
  bankAccount: string | null;
}

interface FormOptions {
  branches: { id: string; code: string; name: string }[];
  departments: string[];
  designationOptions: DesignationOption[];
  employmentTypes: string[];
  shifts: { id: string; label: string }[];
  managers: { id: string; label: string }[];
  roles: { id: string; name: string }[];
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let employee: EmployeeDetail;
  try {
    employee = await backendFetch<EmployeeDetail>(`/api/mobile/hr/employees/${id}`);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) notFound();
    throw error;
  }

  const options = await backendFetch<FormOptions>(`/api/mobile/hr/employees/form-options?excludeId=${id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${employee.firstName} ${employee.lastName}`}
        description="Update employee master data, salary structure, and payroll details."
      />
      <EmployeeForm
        mode="edit"
        branches={options.branches}
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
          joinedAt: employee.joinedAt.slice(0, 10),
          status: employee.status,
          basicSalary: employee.basicSalary,
          houseAllowance: employee.houseAllowance,
          transportAllowance: employee.transportAllowance,
          medicalAllowance: employee.medicalAllowance,
          otherAllowance: employee.otherAllowance,
          providentFund: employee.providentFund,
          taxDeduction: employee.taxDeduction,
          bankName: employee.bankName,
          bankAccount: employee.bankAccount,
        }}
        departments={options.departments.length ? options.departments : [...DEFAULT_DEPARTMENTS]}
        designationOptions={options.designationOptions}
        employmentTypes={options.employmentTypes.length ? options.employmentTypes : [...DEFAULT_EMPLOYMENT_TYPES]}
        shifts={options.shifts}
        managers={options.managers}
        roles={options.roles}
      />
    </div>
  );
}
