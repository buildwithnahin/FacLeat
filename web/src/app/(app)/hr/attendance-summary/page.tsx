import { backendFetch } from '@/lib/backend-client';
import {
  AttendanceSummaryHeader,
  AttendanceSummaryCards,
  AttendanceSummaryForm,
  AttendanceSummaryTable,
  AttendanceSummaryDetailPanel,
} from './attendance-summary-components';
import type { SummaryRow } from './attendance-summary-components';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Attendance Summary – HR',
  description: 'Monthly attendance summary report and payroll preparation.',
};

interface SummaryBundle {
  summaryMonth: string;
  branches: { id: string; label: string }[];
  departments: { id: string; label: string }[];
  shifts: { id: string; label: string }[];
  employees: { id: string; label: string }[];
  rows: SummaryRow[];
}

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const params = new URLSearchParams();
  if (sp.summaryMonth) params.set('summaryMonth', sp.summaryMonth);
  if (sp.branchId) params.set('branchId', sp.branchId);

  const { summaryMonth, branches, departments, shifts, employees, rows } = await backendFetch<SummaryBundle>(
    `/api/mobile/hr/attendance-summary?${params.toString()}`,
  );

  const summary = {
    totalEmployees: rows.length,
    presentDays: rows.reduce((s, r) => s + r.presentDays, 0),
    absentDays: rows.reduce((s, r) => s + r.absentDays, 0),
    leaveDays: rows.reduce((s, r) => s + r.leaveDays, 0),
    lateCount: rows.reduce((s, r) => s + r.lateDays, 0),
    earlyExitCount: rows.reduce((s, r) => s + r.earlyExitDays, 0),
    totalOtHours: rows.reduce((s, r) => s + Number(r.totalOtHours), 0).toFixed(1),
    payrollReady: rows.filter((r) => r.status === 'READY_FOR_PAYROLL' || r.isLocked || r.sentToPayroll).length,
    issueFound: rows.filter((r) => r.status === 'ADJUSTMENT_REQUIRED' || r.absentDays > 0).length,
  };

  const detailRow = sp.detail ? rows.find((r) => r.id === sp.detail) : null;

  return (
    <div className="space-y-6">
      <AttendanceSummaryHeader />

      {rows.length > 0 && <AttendanceSummaryCards summary={summary} />}

      <AttendanceSummaryForm branches={branches} departments={departments} shifts={shifts} employees={employees} defaultMonth={summaryMonth} />

      {detailRow && <AttendanceSummaryDetailPanel record={detailRow} />}

      <AttendanceSummaryTable rows={rows} selectedId={sp.detail} />
    </div>
  );
}
