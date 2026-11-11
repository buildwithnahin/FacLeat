import { backendFetch } from '@/lib/backend-client';
import {
  LateEarlyReportFilters,
  LateEarlySummaryCards,
  LateEarlyReportActions,
  LateEarlyReportTable,
  LateEarlyEmployeeDetails,
  MonthlyStatistics,
  LateEarlyPageHeader,
} from './report-components';
import type { ReportFilterOption, LateEarlyRow, MonthlyStatRow } from './report-components';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Late / Early Report – HR',
  description: 'Analyze late arrivals, early exits, and attendance trends by employee, department, and shift.',
};

interface ReportBundle {
  filters: Record<string, string>;
  branches: ReportFilterOption[];
  departments: ReportFilterOption[];
  designations: ReportFilterOption[];
  shifts: ReportFilterOption[];
  employees: ReportFilterOption[];
  report: {
    rows: LateEarlyRow[];
    summary: {
      totalEmployees: number;
      lateEmployees: number;
      earlyExit: number;
      lateAndEarly: number;
      avgLateMinutes: number;
      avgEarlyMinutes: number;
    };
    monthlyStats: MonthlyStatRow[];
  };
}

export default async function LateEarlyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const params = new URLSearchParams();
  for (const key of ['from', 'to', 'branchId', 'department', 'designation', 'shiftId', 'employeeId', 'status', 'lateThreshold', 'earlyThreshold']) {
    const value = sp[key];
    if (value) params.set(key, value);
  }

  const { filters, branches, departments, designations, shifts, employees, report } = await backendFetch<ReportBundle>(
    `/api/mobile/hr/late-early-report?${params.toString()}`,
  );

  const statusOptions: ReportFilterOption[] = [
    { value: 'ON_TIME', label: 'On Time' },
    { value: 'LATE', label: 'Late' },
    { value: 'EARLY_EXIT', label: 'Early Exit' },
    { value: 'LATE_EARLY', label: 'Late + Early' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'LEAVE', label: 'Leave' },
    { value: 'HOLIDAY', label: 'Holiday' },
    { value: 'WEEKEND', label: 'Weekend' },
  ];

  const detailRow = sp.detail ? report.rows.find((r) => r.id === sp.detail) ?? null : null;

  return (
    <div className="space-y-6">
      <LateEarlyPageHeader />

      <LateEarlySummaryCards summary={report.summary} />

      <LateEarlyReportFilters
        defaults={filters}
        branches={branches}
        departments={departments}
        designations={designations}
        shifts={shifts}
        employees={employees}
        statuses={statusOptions}
      />

      <LateEarlyReportActions rows={report.rows} />

      {detailRow && <LateEarlyEmployeeDetails row={detailRow} />}

      <LateEarlyReportTable rows={report.rows} selectedId={sp.detail} />

      <MonthlyStatistics rows={report.monthlyStats} />
    </div>
  );
}
