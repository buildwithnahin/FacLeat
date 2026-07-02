import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import {
  LateEarlyReportFilters,
  LateEarlySummaryCards,
  LateEarlyReportActions,
  LateEarlyReportTable,
  LateEarlyEmployeeDetails,
  MonthlyStatistics,
  LateEarlyPageHeader,
} from './report-components';
import type { ReportFilterOption } from './report-components';

export const metadata = {
  title: 'Late / Early Report – HR',
  description: 'Analyze late arrivals, early exits, and attendance trends by employee, department, and shift.',
};

export default async function LateEarlyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  await authorize(session, 'hr:read');

  // Default date range: current month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const filters = {
    from: sp.from || defaultFrom,
    to: sp.to || defaultTo,
    branchId: sp.branchId || '',
    department: sp.department || '',
    designation: sp.designation || '',
    shiftId: sp.shiftId || '',
    employeeId: sp.employeeId || '',
    status: sp.status || '',
    lateThreshold: sp.lateThreshold || '',
    earlyThreshold: sp.earlyThreshold || '',
  };

  // Fetch filter options and report data in parallel
  const [branches, shifts, employees, reportData] = await Promise.all([
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
    hrService.getLateEarlyReport(session, {
      from: new Date(filters.from),
      to: new Date(filters.to),
      branchId: filters.branchId || undefined,
      department: filters.department || undefined,
      designation: filters.designation || undefined,
      shiftId: filters.shiftId || undefined,
      employeeId: filters.employeeId || undefined,
      status: filters.status || undefined,
      lateThreshold: filters.lateThreshold ? Number(filters.lateThreshold) : undefined,
      earlyThreshold: filters.earlyThreshold ? Number(filters.earlyThreshold) : undefined,
    }),
  ]);

  // Extract unique departments & designations from active employees
  const departmentSet = new Set<string>();
  const designationSet = new Set<string>();
  for (const emp of employees) {
    if (emp.department) departmentSet.add(emp.department);
    if (emp.designation) designationSet.add(emp.designation);
  }

  const branchOptions: ReportFilterOption[] = branches.map((b) => ({
    value: b.id,
    label: `${b.code} · ${b.name}`,
  }));

  const departmentOptions: ReportFilterOption[] = Array.from(departmentSet)
    .sort()
    .map((d) => ({ value: d, label: d }));

  const designationOptions: ReportFilterOption[] = Array.from(designationSet)
    .sort()
    .map((d) => ({ value: d, label: d }));

  const shiftOptions: ReportFilterOption[] = shifts.map((s) => ({
    value: s.id,
    label: `${s.code} · ${s.name}`,
  }));

  const employeeOptions: ReportFilterOption[] = employees.map((e) => ({
    value: e.id,
    label: `${e.code} · ${e.firstName} ${e.lastName}`,
  }));

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

  // Find detail row if ?detail= param is set
  const detailRow = sp.detail
    ? reportData.rows.find((r) => r.id === sp.detail) ?? null
    : null;

  return (
    <div className="space-y-6">
      <LateEarlyPageHeader />

      <LateEarlySummaryCards summary={reportData.summary} />

      <LateEarlyReportFilters
        defaults={filters}
        branches={branchOptions}
        departments={departmentOptions}
        designations={designationOptions}
        shifts={shiftOptions}
        employees={employeeOptions}
        statuses={statusOptions}
      />

      <LateEarlyReportActions rows={reportData.rows} />

      {detailRow && <LateEarlyEmployeeDetails row={detailRow} />}

      <LateEarlyReportTable rows={reportData.rows} selectedId={sp.detail} />

      <MonthlyStatistics rows={reportData.monthlyStats} />
    </div>
  );
}
