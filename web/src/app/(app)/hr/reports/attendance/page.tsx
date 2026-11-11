import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { AttendanceReportActions } from './_components/attendance-report-actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Attendance Reports' };

type SearchParams = Promise<{
  reportType?: string;
  branchId?: string;
  department?: string;
  designation?: string;
  shiftId?: string;
  employeeId?: string;
  employmentType?: string;
  attendanceStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

const ATTENDANCE_REPORT_TYPES = [
  'DAILY_ATTENDANCE',
  'MONTHLY_ATTENDANCE',
  'ATTENDANCE_SUMMARY',
  'LATE_ARRIVAL',
  'EARLY_EXIT',
  'OVERTIME',
  'MISSING_ATTENDANCE',
  'ABSENT',
  'SHIFT_ATTENDANCE',
  'ATTENDANCE_ADJUSTMENT',
] as const;

interface ReportCenterResponse {
  dashboard: {
    presentToday: number;
    absentToday: number;
    lateToday: number;
    onLeaveToday: number;
    overtimeEmployees: number;
    attendanceRate: string;
  };
  filters: {
    reportType: string;
    branchId: string;
    department: string;
    designation: string;
    shiftId: string;
    employeeId: string;
    employmentType: string;
    attendanceStatus: string;
    dateFrom: string;
    dateTo: string;
  };
  options: {
    branches: Array<{ id: string; code: string; name: string }>;
    departments: string[];
    designations: string[];
    shifts: Array<{ value: string; label: string }>;
    employees: Array<{ value: string; label: string }>;
    employmentTypes: string[];
    attendanceStatuses: string[];
  };
  report: { title: string; description: string; columns: string[]; rows: Array<Array<string | number>> };
  meta: { rowCount: number };
}

const REPORT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'DAILY_ATTENDANCE', label: 'Daily Attendance Report' },
  { value: 'MONTHLY_ATTENDANCE', label: 'Monthly Attendance Report' },
  { value: 'ATTENDANCE_SUMMARY', label: 'Attendance Summary Report' },
  { value: 'LATE_ARRIVAL', label: 'Late Arrival Report' },
  { value: 'EARLY_EXIT', label: 'Early Exit Report' },
  { value: 'OVERTIME', label: 'Overtime Report' },
  { value: 'MISSING_ATTENDANCE', label: 'Missing Attendance Report' },
  { value: 'ABSENT', label: 'Absent Report' },
  { value: 'SHIFT_ATTENDANCE', label: 'Shift Attendance Report' },
  { value: 'ATTENDANCE_ADJUSTMENT', label: 'Attendance Adjustment Report' },
];

export default async function AttendanceReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await getSession();
  const sp = await searchParams;
  const reportType = (ATTENDANCE_REPORT_TYPES as readonly string[]).includes(sp.reportType ?? 'DAILY_ATTENDANCE')
    ? (sp.reportType as string)
    : 'DAILY_ATTENDANCE';

  const qs = new URLSearchParams();
  if (sp.branchId) qs.set('branchId', sp.branchId);
  if (sp.department) qs.set('department', sp.department);
  if (sp.designation) qs.set('designation', sp.designation);
  if (sp.shiftId) qs.set('shiftId', sp.shiftId);
  if (sp.employeeId) qs.set('employeeId', sp.employeeId);
  if (sp.employmentType) qs.set('employmentType', sp.employmentType);
  if (sp.attendanceStatus) qs.set('attendanceStatus', sp.attendanceStatus);
  if (sp.dateFrom) qs.set('dateFrom', sp.dateFrom);
  if (sp.dateTo) qs.set('dateTo', sp.dateTo);

  const data = await backendFetch<ReportCenterResponse>(
    `/api/mobile/reports/hr/attendance/${reportType}?${qs.toString()}`,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        description="Centralized read-only attendance analytics for daily logs, monthly summaries, lateness, overtime, missing punches, and adjustments."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Present Today" value={String(data.dashboard.presentToday)} />
        <SummaryCard title="Absent Today" value={String(data.dashboard.absentToday)} />
        <SummaryCard title="Late Today" value={String(data.dashboard.lateToday)} />
        <SummaryCard title="On Leave" value={String(data.dashboard.onLeaveToday)} />
        <SummaryCard title="Overtime Employees" value={String(data.dashboard.overtimeEmployees)} />
        <SummaryCard title="Attendance Rate" value={data.dashboard.attendanceRate} />
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
                options={data.options.shifts}
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
                label="Attendance Status"
                name="attendanceStatus"
                defaultValue={data.filters.attendanceStatus}
                options={data.options.attendanceStatuses.map((status) => ({ value: status, label: status }))}
              />
              <DateField label="Date From" name="dateFrom" defaultValue={data.filters.dateFrom} />
              <DateField label="Date To" name="dateTo" defaultValue={data.filters.dateTo} />
            </div>

            <div className="flex flex-wrap gap-2">
              <AttendanceReportActions
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
