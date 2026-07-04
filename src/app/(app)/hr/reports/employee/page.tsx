import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { getSession } from '@/server/auth/session';
import {
  EMPLOYEE_REPORT_TYPES,
  employeeReportsService,
  type EmployeeReportType,
} from '@/server/services/employee-reports.service';
import { EmployeeReportActions } from './_components/employee-report-actions';

export const metadata = { title: 'Employee Reports' };

type SearchParams = Promise<{
  reportType?: string;
  branchId?: string;
  department?: string;
  designation?: string;
  shiftId?: string;
  employmentType?: string;
  employeeStatus?: string;
  employeeId?: string;
  joiningFrom?: string;
  joiningTo?: string;
}>;

const REPORT_TYPE_OPTIONS: Array<{ value: EmployeeReportType; label: string }> = [
  { value: 'EMPLOYEE_LIST', label: 'Employee List' },
  { value: 'EMPLOYEE_DIRECTORY', label: 'Employee Directory' },
  { value: 'DEPARTMENT_WISE', label: 'Department Wise' },
  { value: 'DESIGNATION_WISE', label: 'Designation Wise' },
  { value: 'BRANCH_WISE', label: 'Branch Wise' },
  { value: 'SHIFT_WISE', label: 'Shift Wise' },
  { value: 'EMPLOYMENT_TYPE_WISE', label: 'Employment Type Wise' },
  { value: 'JOINING_REPORT', label: 'Joining Report' },
  { value: 'CONTRACT_EXPIRY', label: 'Contract Expiry Report' },
  { value: 'EMPLOYEE_STATUS', label: 'Employee Status Report' },
];

export default async function EmployeeReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const reportType = EMPLOYEE_REPORT_TYPES.includes((sp.reportType ?? 'EMPLOYEE_LIST') as EmployeeReportType)
    ? (sp.reportType as EmployeeReportType)
    : 'EMPLOYEE_LIST';

  const data = await employeeReportsService.getReportCenter(session, {
    reportType,
    branchId: sp.branchId,
    department: sp.department,
    designation: sp.designation,
    shiftId: sp.shiftId,
    employmentType: sp.employmentType,
    employeeStatus: sp.employeeStatus,
    employeeId: sp.employeeId,
    joiningFrom: sp.joiningFrom,
    joiningTo: sp.joiningTo,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Reports"
        description="Generate employee-related reports using a shared filter panel. This module is read-only."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total Employees" value={String(data.dashboard.totalEmployees)} />
        <SummaryCard title="Active" value={String(data.dashboard.activeEmployees)} />
        <SummaryCard title="Inactive" value={String(data.dashboard.inactiveEmployees)} />
        <SummaryCard title="Probation" value={String(data.dashboard.probationEmployees)} />
        <SummaryCard title="Contract" value={String(data.dashboard.contractEmployees)} />
      </div>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Report Selection & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Report Type"
                name="reportType"
                defaultValue={data.filters.reportType}
                options={REPORT_TYPE_OPTIONS}
                includeEmptyOption={false}
              />
              <SelectField
                label="Branch"
                name="branchId"
                defaultValue={data.filters.branchId}
                options={data.options.branches.map((branch) => ({
                  value: branch.id,
                  label: `${branch.code} · ${branch.name}`,
                }))}
              />
              <SelectField
                label="Department"
                name="department"
                defaultValue={data.filters.department}
                options={data.options.departments.map((department) => ({ value: department, label: department }))}
              />
              <SelectField
                label="Designation"
                name="designation"
                defaultValue={data.filters.designation}
                options={data.options.designations.map((designation) => ({ value: designation, label: designation }))}
              />
              <SelectField
                label="Shift"
                name="shiftId"
                defaultValue={data.filters.shiftId}
                options={data.options.shifts.map((shift) => ({ value: shift.id, label: shift.label }))}
              />
              <SelectField
                label="Employment Type"
                name="employmentType"
                defaultValue={data.filters.employmentType}
                options={data.options.employmentTypes.map((employmentType) => ({ value: employmentType, label: employmentType }))}
              />
              <SelectField
                label="Employee Status"
                name="employeeStatus"
                defaultValue={data.filters.employeeStatus}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'ON_LEAVE', label: 'On Leave' },
                  { value: 'INACTIVE', label: 'Inactive' },
                  { value: 'RESIGNED', label: 'Resigned' },
                  { value: 'TERMINATED', label: 'Terminated' },
                ]}
              />
              <DateField label="Joining Date From" name="joiningFrom" defaultValue={data.filters.joiningFrom} />
              <DateField label="Joining Date To" name="joiningTo" defaultValue={data.filters.joiningTo} />
              <SelectField
                label="Employee (Optional)"
                name="employeeId"
                defaultValue={data.filters.employeeId}
                options={data.options.employees}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <EmployeeReportActions
                filename={`${data.report.title.toLowerCase().replaceAll(' ', '-')}.csv`}
                columns={data.report.columns}
                rows={data.report.rows}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {data.report.title}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{data.report.description}</p>
            </div>
            <Badge variant="outline">
              {data.filters.reportType === 'CONTRACT_EXPIRY' ? data.meta.filteredContracts : data.meta.filteredEmployees} Rows
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  {data.report.columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-left">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={data.report.columns.length} className="px-4 py-12 text-center text-muted-foreground">
                      No rows found for the selected report and filters.
                    </td>
                  </tr>
                ) : (
                  data.report.rows.map((row, index) => (
                    <tr key={`${data.filters.reportType}-${index}`} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                      {row.map((value, cellIndex) => (
                        <td key={`${index}-${cellIndex}`} className="px-4 py-3">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      </CardContent>
    </Card>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  includeEmptyOption = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  includeEmptyOption?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {includeEmptyOption ? <option value="">All</option> : null}
        {options.filter((option) => option.value).map((option, index) => (
          <option key={`${name}-${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} type="date" defaultValue={defaultValue} />
    </div>
  );
}
