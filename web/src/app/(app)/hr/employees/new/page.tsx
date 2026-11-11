import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { EmployeeForm } from '../_components/employee-form';
import { DEFAULT_DEPARTMENTS, DEFAULT_EMPLOYMENT_TYPES } from '@/server/validators/hr';
import type { DesignationOption } from '@/lib/hr-master-data';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New employee' };

interface FormOptions {
  branches: { id: string; code: string; name: string }[];
  departments: string[];
  designationOptions: DesignationOption[];
  employmentTypes: string[];
  shifts: { id: string; label: string }[];
  managers: { id: string; label: string }[];
  roles: { id: string; name: string }[];
}

export default async function NewEmployeePage() {
  const options = await backendFetch<FormOptions>('/api/mobile/hr/employees/form-options');

  return (
    <div>
      <PageHeader title="New employee" description="Create an employee profile with salary structure." />
      <EmployeeForm
        mode="create"
        branches={options.branches}
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
