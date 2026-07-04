import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { getSession } from '@/server/auth/session';
import {
  RECRUITMENT_REPORT_TYPES,
  recruitmentReportsService,
  type RecruitmentReportType,
} from '@/server/services/recruitment-reports.service';
import { RecruitmentReportActions } from './_components/recruitment-report-actions';

export const metadata = { title: 'Recruitment Reports' };

type SearchParams = Promise<{
  reportType?: string;
  branchId?: string;
  department?: string;
  jobPosition?: string;
  recruitmentRequestId?: string;
  recruiterId?: string;
  interviewer?: string;
  candidateStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

const REPORT_TYPE_OPTIONS: Array<{ value: RecruitmentReportType; label: string }> = [
  { value: 'RECRUITMENT_REQUEST', label: 'Recruitment Request Report' },
  { value: 'VACANCY', label: 'Vacancy Report' },
  { value: 'CANDIDATE', label: 'Candidate Report' },
  { value: 'INTERVIEW_SCHEDULE', label: 'Interview Schedule Report' },
  { value: 'INTERVIEW_RESULT', label: 'Interview Result Report' },
  { value: 'JOB_OFFER', label: 'Job Offer Report' },
  { value: 'JOINING', label: 'Joining Report' },
  { value: 'PIPELINE', label: 'Recruitment Pipeline Report' },
  { value: 'SUMMARY', label: 'Recruitment Summary Report' },
];

export default async function RecruitmentReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const reportType = RECRUITMENT_REPORT_TYPES.includes((sp.reportType ?? 'SUMMARY') as RecruitmentReportType)
    ? (sp.reportType as RecruitmentReportType)
    : 'SUMMARY';

  const data = await recruitmentReportsService.getReportCenter(session, {
    reportType,
    branchId: sp.branchId,
    department: sp.department,
    jobPosition: sp.jobPosition,
    recruitmentRequestId: sp.recruitmentRequestId,
    recruiterId: sp.recruiterId,
    interviewer: sp.interviewer,
    candidateStatus: sp.candidateStatus,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment Reports"
        description="Centralized read-only reports for recruitment requests, candidates, interviews, offers, joining, and pipeline performance."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Recruitment Requests" value={String(data.dashboard.recruitmentRequests)} />
        <SummaryCard title="Open Vacancies" value={String(Math.max(data.dashboard.openVacancies, 0))} />
        <SummaryCard title="Candidates" value={String(data.dashboard.candidates)} />
        <SummaryCard title="Interviews Scheduled" value={String(data.dashboard.interviewsScheduled)} />
        <SummaryCard title="Offers Sent" value={String(data.dashboard.offersSent)} />
        <SummaryCard title="Employees Joined" value={String(data.dashboard.employeesJoined)} />
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
                label="Job Position"
                name="jobPosition"
                defaultValue={data.filters.jobPosition}
                options={data.options.positions.map((position) => ({ value: position, label: position }))}
              />
              <SelectField
                label="Recruitment Request"
                name="recruitmentRequestId"
                defaultValue={data.filters.recruitmentRequestId}
                options={data.options.recruitmentRequests}
              />
              <SelectField
                label="Recruiter"
                name="recruiterId"
                defaultValue={data.filters.recruiterId}
                options={data.options.recruiters}
              />
              <SelectField
                label="Interviewer"
                name="interviewer"
                defaultValue={data.filters.interviewer}
                options={data.options.interviewers}
              />
              <SelectField
                label="Candidate Status"
                name="candidateStatus"
                defaultValue={data.filters.candidateStatus}
                options={data.options.candidateStatuses.map((status) => ({ value: status, label: status }))}
              />
              <DateField label="Date From" name="dateFrom" defaultValue={data.filters.dateFrom} />
              <DateField label="Date To" name="dateTo" defaultValue={data.filters.dateTo} />
            </div>

            <div className="flex flex-wrap gap-2">
              <RecruitmentReportActions
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
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
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
