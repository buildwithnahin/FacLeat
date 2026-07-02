import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { attendanceSummaryService } from '@/server/services/attendance-summary.service';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import {
  AttendanceSummaryHeader,
  AttendanceSummaryCards,
  AttendanceSummaryForm,
  AttendanceSummaryTable,
  AttendanceSummaryDetailPanel,
} from './attendance-summary-components';
import type { SummaryRow } from './attendance-summary-components';

export const metadata = {
  title: 'Attendance Summary – HR',
  description: 'Monthly attendance summary report and payroll preparation.',
};

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  await authorize(session, 'hr:read');

  const activeBranch = session?.activeBranchId ?? undefined;
  
  // Default to current month if not specified
  const now = new Date();
  const currentMonthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const summaryMonth = sp.summaryMonth || currentMonthStr;
  const branchId = sp.branchId || activeBranch;

  const [branches, shifts, employees] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.shift.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    hrService.listEmployees(session, { status: 'ACTIVE' }),
  ]);

  // If a branch and month are specified, fetch the summary records
  const records = (branchId && summaryMonth)
    ? await attendanceSummaryService.list(session, {
        branchId,
        summaryMonth,
      })
    : [];

  // Unique departments
  const deptSet = new Set<string>();
  for (const e of employees) {
    if (e.department) deptSet.add(e.department);
  }

  const branchOptions = branches.map(b => ({ id: b.id, label: `${b.code} · ${b.name}` }));
  const deptOptions = Array.from(deptSet).sort().map(d => ({ id: d, label: d }));
  const shiftOptions = shifts.map(s => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  const empOptions = employees.map(e => ({ id: e.id, label: `${e.code} · ${e.firstName} ${e.lastName}` }));

  // Map records to table rows
  const rows: SummaryRow[] = records.map(r => ({
    id: r.id,
    branchId: r.branchId,
    employeeCode: r.employee.code,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
    department: r.employee.department ?? '-',
    designation: r.employee.designation ?? '-',
    summaryMonth: r.summaryMonth,
    totalCalendarDays: r.totalCalendarDays,
    weeklyOffDays: r.weeklyOffDays,
    holidayDays: r.holidayDays,
    workingDays: r.workingDays,
    presentDays: r.presentDays,
    absentDays: r.absentDays,
    leaveDays: r.leaveDays,
    lateDays: r.lateDays,
    earlyExitDays: r.earlyExitDays,
    totalWorkedHours: Number(r.totalWorkedHours).toFixed(1),
    totalOtHours: Number(r.totalOtHours).toFixed(1),
    payableDays: Number(r.payableDays).toFixed(1),
    status: r.status,
    isLocked: r.isLocked,
    sentToPayroll: r.sentToPayroll,
  }));

  // Summary Metrics
  const summary = {
    totalEmployees: rows.length,
    presentDays: rows.reduce((s, r) => s + r.presentDays, 0),
    absentDays: rows.reduce((s, r) => s + r.absentDays, 0),
    leaveDays: rows.reduce((s, r) => s + r.leaveDays, 0),
    lateCount: rows.reduce((s, r) => s + r.lateDays, 0),
    earlyExitCount: rows.reduce((s, r) => s + r.earlyExitDays, 0),
    totalOtHours: rows.reduce((s, r) => s + Number(r.totalOtHours), 0).toFixed(1),
    payrollReady: rows.filter(r => r.status === 'READY_FOR_PAYROLL' || r.isLocked || r.sentToPayroll).length,
    issueFound: rows.filter(r => r.status === 'ADJUSTMENT_REQUIRED' || r.absentDays > 0).length,
  };

  // Find detailed record if requested
  const detailRow = sp.detail ? rows.find(r => r.id === sp.detail) : null;

  return (
    <div className="space-y-6">
      <AttendanceSummaryHeader />
      
      {rows.length > 0 && <AttendanceSummaryCards summary={summary} />}
      
      <AttendanceSummaryForm 
        branches={branchOptions}
        departments={deptOptions}
        shifts={shiftOptions}
        employees={empOptions}
        defaultMonth={summaryMonth}
      />

      {detailRow && <AttendanceSummaryDetailPanel record={detailRow} />}

      <AttendanceSummaryTable rows={rows} selectedId={sp.detail} />
    </div>
  );
}
