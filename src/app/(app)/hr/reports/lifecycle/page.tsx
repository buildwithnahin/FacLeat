import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { getSession } from '@/server/auth/session';
import {
  LIFECYCLE_REPORT_TYPES,
  lifecycleReportsService,
  type LifecycleReportType,
} from '@/server/services/lifecycle-reports.service';
import { LifecycleReportActions } from './_components/lifecycle-report-actions';

export const metadata = { title: 'Employee Lifecycle Reports' };

type SearchParams = Promise<{
  reportType?: string;
  branchId?: string;
  department?: string;
  designation?: string;
  employmentType?: string;
  employeeId?: string;
  lifecycleType?: string;
  status?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  lastWorkingFrom?: string;
  lastWorkingTo?: string;
}>;

const REPORT_TYPE_OPTIONS: Array<{ value: LifecycleReportType; label: string }> = [
  { value: 'CONFIRMATION', label: 'Confirmation Report' },
  { value: 'TRANSFER', label: 'Transfer Report' },
  { value: 'PROMOTION', label: 'Promotion Report' },
  { value: 'INCREMENT', label: 'Increment Report' },
  { value: 'RESIGNATION', label: 'Resignation Report' },
  { value: 'TERMINATION', label: 'Termination Report' },
  { value: 'EXIT_CLEARANCE', label: 'Exit Clearance Report' },
  { value: 'FINAL_SETTLEMENT', label: 'Final Settlement Report' },
  { value: 'EMPLOYEE_MOVEMENT', label: 'Employee Movement Report' },
  { value: 'LIFECYCLE_SUMMARY', label: 'Lifecycle Summary Report' },
];

export default async function LifecycleReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const reportType = LIFECYCLE_REPORT_TYPES.includes((sp.reportType ?? 'LIFECYCLE_SUMMARY') as LifecycleReportType)
    ? (sp.reportType as LifecycleReportType)
    : 'LIFECYCLE_SUMMARY';

  const data = await lifecycleReportsService.getReportCenter(session, {
    reportType,
    branchId: sp.branchId,
    department: sp.department,
    designation: sp.designation,
    employmentType: sp.employmentType,
    employeeId: sp.employeeId,
    lifecycleType: sp.lifecycleType,
    status: sp.status,
    effectiveFrom: sp.effectiveFrom,
    effectiveTo: sp.effectiveTo,
    lastWorkingFrom: sp.lastWorkingFrom,
    lastWorkingTo: sp.lastWorkingTo,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Lifecycle Reports"
        description="Centralized read-only lifecycle reporting from confirmation through transfer, promotion, increment, resignation, exit clearance, and final settlement."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <SummaryCard title="Confirmations" value={String(data.dashboard.confirmations)} />
        <SummaryCard title="Transfers" value={String(data.dashboard.transfers)} />
        <SummaryCard title="Promotions" value={String(data.dashboard.promotions)} />
        <SummaryCard title="Increments" value={String(data.dashboard.increments)} />
        <SummaryCard title="Resignations" value={String(data.dashboard.resignations)} />
        <SummaryCard title="Terminations" value={String(data.dashboard.terminations)} />
        <SummaryCard title="Final Settlements" value={String(data.dashboard.finalSettlements)} />
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
                label="Employment Type"
                name="employmentType"
                defaultValue={data.filters.employmentType}
                options={data.options.employmentTypes.map((type) => ({ value: type, label: type }))}
              />
              <SelectField
                label="Employee"
                name="employeeId"
                defaultValue={data.filters.employeeId}
                options={data.options.employees}
              />
              <SelectField
                label="Lifecycle Type"
                name="lifecycleType"
                defaultValue={data.filters.lifecycleType}
                options={data.options.lifecycleTypes.map((type) => ({ value: type, label: type.replaceAll('_', ' ') }))}
              />
              <SelectField
                label="Status"
                name="status"
                defaultValue={data.filters.status}
                options={data.options.statuses.map((status) => ({ value: status, label: status.replaceAll('_', ' ') }))}
              />
              <DateField label="Effective Date From" name="effectiveFrom" defaultValue={data.filters.effectiveFrom} />
              <DateField label="Effective Date To" name="effectiveTo" defaultValue={data.filters.effectiveTo} />
              <DateField label="Last Working Date From" name="lastWorkingFrom" defaultValue={data.filters.lastWorkingFrom} />
              <DateField label="Last Working Date To" name="lastWorkingTo" defaultValue={data.filters.lastWorkingTo} />
            </div>

            <div className="flex flex-wrap gap-2">
              <LifecycleReportActions
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
