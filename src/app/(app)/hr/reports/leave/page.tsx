import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { getSession } from '@/server/auth/session';
import {
  LEAVE_REPORT_TYPES,
  leaveReportsService,
  type LeaveReportType,
} from '@/server/services/leave-reports.service';
import { LeaveReportActions } from './_components/leave-report-actions';

export const metadata = { title: 'Leave Reports' };

type SearchParams = Promise<{
  reportType?: string;
  branchId?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  employmentType?: string;
  leaveType?: string;
  leaveStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  payrollYear?: string;
}>;

const REPORT_TYPE_OPTIONS: Array<{ value: LeaveReportType; label: string }> = [
  { value: 'LEAVE_APPLICATION', label: 'Leave Application Report' },
  { value: 'LEAVE_APPROVAL', label: 'Leave Approval Report' },
  { value: 'LEAVE_BALANCE', label: 'Leave Balance Report' },
  { value: 'LEAVE_UTILIZATION', label: 'Leave Utilization Report' },
  { value: 'LEAVE_ENCASHMENT', label: 'Leave Encashment Report' },
  { value: 'LEAVE_SUMMARY', label: 'Leave Summary Report' },
  { value: 'EMPLOYEE_LEAVE_HISTORY', label: 'Employee Leave History' },
  { value: 'LEAVE_TYPE_ANALYSIS', label: 'Leave Type Analysis' },
  { value: 'LEAVE_TREND', label: 'Leave Trend Report' },
];

export default async function LeaveReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const reportType = LEAVE_REPORT_TYPES.includes((sp.reportType ?? 'LEAVE_APPLICATION') as LeaveReportType)
    ? (sp.reportType as LeaveReportType)
    : 'LEAVE_APPLICATION';

  const data = await leaveReportsService.getReportCenter(session, {
    reportType,
    branchId: sp.branchId,
    department: sp.department,
    designation: sp.designation,
    employeeId: sp.employeeId,
    employmentType: sp.employmentType,
    leaveType: sp.leaveType,
    leaveStatus: sp.leaveStatus,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    payrollYear: sp.payrollYear,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Reports"
        description="Centralized read-only leave reporting for applications, approvals, balances, utilization, leave history, type analysis, and trend reporting."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Leave Applications" value={String(data.dashboard.leaveApplications)} />
        <SummaryCard title="Pending Approval" value={String(data.dashboard.pendingApproval)} />
        <SummaryCard title="Approved" value={String(data.dashboard.approved)} />
        <SummaryCard title="Rejected" value={String(data.dashboard.rejected)} />
        <SummaryCard title="Employees On Leave" value={String(data.dashboard.employeesOnLeaveToday)} />
        <SummaryCard title="Leave Utilization" value={data.dashboard.leaveUtilization} />
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
                label="Employee"
                name="employeeId"
                defaultValue={data.filters.employeeId}
                options={data.options.employees}
              />
              <SelectField
                label="Employment Type"
                name="employmentType"
                defaultValue={data.filters.employmentType}
                options={data.options.employmentTypes.map((type) => ({ value: type, label: type }))}
              />
              <SelectField
                label="Leave Type"
                name="leaveType"
                defaultValue={data.filters.leaveType}
                options={data.options.leaveTypes}
              />
              <SelectField
                label="Leave Status"
                name="leaveStatus"
                defaultValue={data.filters.leaveStatus}
                options={data.options.leaveStatuses.map((status) => ({ value: status, label: status }))}
              />
              <DateField label="Date From" name="dateFrom" defaultValue={data.filters.dateFrom} />
              <DateField label="Date To" name="dateTo" defaultValue={data.filters.dateTo} />
              <div className="space-y-1.5">
                <Label htmlFor="payrollYear" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payroll Year
                </Label>
                <Input id="payrollYear" name="payrollYear" type="number" defaultValue={data.filters.payrollYear} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <LeaveReportActions
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
            <Badge variant="outline">{data.meta.rowCount} Rows</Badge>
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
