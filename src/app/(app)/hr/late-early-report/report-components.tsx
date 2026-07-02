'use client';

import Link from 'next/link';
import { Download, FileText, Printer, Search, RotateCcw, Clock, UserX, Users, AlertTriangle, TrendingDown, BarChart3, Eye, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ReportFilterOption = {
  value: string;
  label: string;
};

export type LateEarlyRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branch: string;
  department: string;
  designation: string;
  shift: string;
  shiftStart: string;
  shiftEnd: string;
  date: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number;
  earlyMinutes: number;
  workedHours: string;
  otHours: string;
  status: string;
};

export type MonthlyStatRow = {
  employeeId: string;
  employeeName: string;
  totalWorkingDays: number;
  lateDays: number;
  earlyExitDays: number;
  avgLateMinutes: number;
  avgEarlyMinutes: number;
};

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary';

function statusVariant(status: string) {
  if (status === 'ON_TIME') return 'success' as const;
  if (status === 'LATE') return 'warning' as const;
  if (status === 'EARLY_EXIT') return 'warning' as const;
  if (status === 'LATE_EARLY') return 'destructive' as const;
  if (status === 'ABSENT') return 'destructive' as const;
  return 'outline' as const;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ON_TIME: 'On Time',
    LATE: 'Late',
    EARLY_EXIT: 'Early Exit',
    LATE_EARLY: 'Late + Early',
    ABSENT: 'Absent',
    LEAVE: 'Leave',
    HOLIDAY: 'Holiday',
    WEEKEND: 'Weekend',
  };
  return labels[status] ?? status;
}

function downloadCsv(rows: LateEarlyRow[]) {
  const headers = [
    'Employee Code', 'Employee Name', 'Date', 'Branch', 'Department',
    'Designation', 'Shift', 'Shift Start', 'Check In', 'Late Minutes',
    'Check Out', 'Early Minutes', 'Worked Hours', 'OT', 'Status',
  ];
  const lines = rows.map((row) =>
    [
      row.employeeCode, row.employeeName, row.date, row.branch, row.department,
      row.designation, row.shift, row.shiftStart, row.checkIn, String(row.lateMinutes),
      row.checkOut, String(row.earlyMinutes), row.workedHours, row.otHours, row.status,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'late-early-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Page Header ───────────────────────────────────────────────────────── */
export function LateEarlyPageHeader() {
  return (
    <div className="flex items-start justify-between gap-4 mb-2">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Late / Early Report</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Analyze late arrivals, early exits, and attendance trends across your workforce
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Filters ───────────────────────────────────────────────────────────── */
export function LateEarlyReportFilters({
  defaults,
  branches,
  departments,
  designations,
  shifts,
  employees,
  statuses,
}: {
  defaults: Record<string, string>;
  branches: ReportFilterOption[];
  departments: ReportFilterOption[];
  designations: ReportFilterOption[];
  shifts: ReportFilterOption[];
  employees: ReportFilterOption[];
  statuses: ReportFilterOption[];
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-primary" />
          Report Filters
        </div>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="From Date" name="from" type="date" required defaultValue={defaults.from} />
          <Field label="To Date" name="to" type="date" required defaultValue={defaults.to} />
          <SelectField label="Branch" name="branchId" defaultValue={defaults.branchId} options={branches} />
          <SelectField label="Department" name="department" defaultValue={defaults.department} options={departments} />
          <SelectField label="Designation" name="designation" defaultValue={defaults.designation} options={designations} />
          <SelectField label="Shift" name="shiftId" defaultValue={defaults.shiftId} options={shifts} />
          <SelectField label="Employee" name="employeeId" defaultValue={defaults.employeeId} options={employees} />
          <SelectField label="Status" name="status" defaultValue={defaults.status} options={statuses} />
          <Field label="Late Threshold (Min)" name="lateThreshold" type="number" defaultValue={defaults.lateThreshold} />
          <Field label="Early Exit Threshold (Min)" name="earlyThreshold" type="number" defaultValue={defaults.earlyThreshold} />
          <div className="xl:col-span-5 flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
            <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80 shadow-sm">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/hr/late-early-report">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Summary Cards ─────────────────────────────────────────────────────── */
export function LateEarlySummaryCards({
  summary,
}: {
  summary: {
    totalEmployees: number;
    lateEmployees: number;
    earlyExit: number;
    lateAndEarly: number;
    avgLateMinutes: number;
    avgEarlyMinutes: number;
  };
}) {
  const cards = [
    { label: 'Total Employees', value: summary.totalEmployees, icon: Users, gradient: 'from-slate-500 to-slate-700', shadow: 'shadow-slate-500/15' },
    { label: 'Late Employees', value: summary.lateEmployees, icon: Clock, gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-500/15' },
    { label: 'Early Exit', value: summary.earlyExit, icon: ArrowUpRight, gradient: 'from-orange-500 to-orange-700', shadow: 'shadow-orange-500/15' },
    { label: 'Late + Early', value: summary.lateAndEarly, icon: AlertTriangle, gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-500/15' },
    { label: 'Avg Late Minutes', value: summary.avgLateMinutes, icon: TrendingDown, gradient: 'from-blue-500 to-blue-700', shadow: 'shadow-blue-500/15', suffix: ' min' },
    { label: 'Avg Early Minutes', value: summary.avgEarlyMinutes, icon: BarChart3, gradient: 'from-indigo-500 to-indigo-700', shadow: 'shadow-indigo-500/15', suffix: ' min' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} ${card.shadow} shadow-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums tracking-tight">
                {card.value}
                {card.suffix && <span className="text-base font-medium text-muted-foreground">{card.suffix}</span>}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Action Buttons ────────────────────────────────────────────────────── */
export function LateEarlyReportActions({ rows }: { rows: LateEarlyRow[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(rows)} className="shadow-sm">
        <Download className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="shadow-sm">
        <FileText className="mr-2 h-4 w-4" />
        Export PDF
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="shadow-sm">
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
        {rows.length} record{rows.length !== 1 ? 's' : ''} found
      </span>
    </div>
  );
}

/* ─── Report Table ──────────────────────────────────────────────────────── */
export function LateEarlyReportTable({
  rows,
  selectedId,
}: {
  rows: LateEarlyRow[];
  selectedId?: string;
}) {
  if (rows.length === 0) {
    return (
      <Card className="border-border/50">
        <div className="px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
            <UserX className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No attendance records found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or date range</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" />
          Attendance Report
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Employee</th>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Shift</th>
              <th className="px-4 py-3 text-left font-semibold">Shift Start</th>
              <th className="px-4 py-3 text-left font-semibold">Check In</th>
              <th className="px-4 py-3 text-left font-semibold">Late (Min)</th>
              <th className="px-4 py-3 text-left font-semibold">Check Out</th>
              <th className="px-4 py-3 text-left font-semibold">Early (Min)</th>
              <th className="px-4 py-3 text-left font-semibold">Worked</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={
                  selectedId === row.id
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : 'hover:bg-muted/20 transition-colors'
                }
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{row.employeeCode}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.date}</td>
                <td className="px-4 py-3">{row.shift}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.shiftStart}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.checkIn}</td>
                <td className="px-4 py-3">
                  {row.lateMinutes > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      {row.lateMinutes}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.checkOut}</td>
                <td className="px-4 py-3">
                  {row.earlyMinutes > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
                      {row.earlyMinutes}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.workedHours}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                    <Link href={`/hr/late-early-report?detail=${row.id}&from=${row.date}&to=${row.date}`}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      View
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── Employee Detail Panel ─────────────────────────────────────────────── */
export function LateEarlyEmployeeDetails({ row }: { row: LateEarlyRow }) {
  return (
    <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Eye className="h-4 w-4 text-primary" />
          Employee Attendance Details
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Employee Name" value={row.employeeName} />
          <ReadOnlyField label="Employee Code" value={row.employeeCode} />
          <ReadOnlyField label="Department" value={row.department} />
          <ReadOnlyField label="Designation" value={row.designation} />
          <ReadOnlyField label="Shift" value={row.shift} />
          <ReadOnlyField label="Attendance Date" value={row.date} />
          <ReadOnlyField label="Shift Start" value={row.shiftStart} />
          <ReadOnlyField label="Shift End" value={row.shiftEnd} />
          <ReadOnlyField label="Check In" value={row.checkIn} />
          <ReadOnlyField label="Check Out" value={row.checkOut} />
          <ReadOnlyField label="Late Minutes" value={row.lateMinutes > 0 ? `${row.lateMinutes} min` : '-'} highlight={row.lateMinutes > 0} />
          <ReadOnlyField label="Early Minutes" value={row.earlyMinutes > 0 ? `${row.earlyMinutes} min` : '-'} highlight={row.earlyMinutes > 0} />
          <ReadOnlyField label="Working Hours" value={row.workedHours} />
          <ReadOnlyField label="OT" value={row.otHours} />
          <ReadOnlyField label="Status" value={statusLabel(row.status)} />
          <ReadOnlyField label="Branch" value={row.branch} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-border/40">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/hr/attendance?date=${row.date}`}>View Attendance</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/hr/attendance-adjustment?date=${row.date}&employeeId=${row.employeeId}`}>Attendance Adjustment</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/hr/late-early-report?employeeId=${row.employeeId}`}>View History</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Monthly Statistics ────────────────────────────────────────────────── */
export function MonthlyStatistics({ rows }: { rows: MonthlyStatRow[] }) {
  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TrendingDown className="h-4 w-4 text-primary" />
          Monthly Employee Statistics
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Aggregated late/early statistics per employee</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground text-sm">
          No employee statistics available for the selected range.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Employee</th>
                <th className="px-4 py-3 text-left font-semibold">Total Working Days</th>
                <th className="px-4 py-3 text-left font-semibold">Late Days</th>
                <th className="px-4 py-3 text-left font-semibold">Early Exit Days</th>
                <th className="px-4 py-3 text-left font-semibold">Avg Late</th>
                <th className="px-4 py-3 text-left font-semibold">Avg Early</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.employeeId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.employeeName}</td>
                  <td className="px-4 py-3 tabular-nums">{row.totalWorkingDays}</td>
                  <td className="px-4 py-3">
                    {row.lateDays > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        {row.lateDays}
                      </span>
                    ) : (
                      <span className="tabular-nums">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.earlyExitDays > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
                        {row.earlyExitDays}
                      </span>
                    ) : (
                      <span className="tabular-nums">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.avgLateMinutes} min</td>
                  <td className="px-4 py-3 tabular-nums">{row.avgEarlyMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ─── Shared Field Components ───────────────────────────────────────────── */
function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} className="shadow-sm" />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: ReportFilterOption[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-xs font-medium">{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={selectClass}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`space-y-1 rounded-lg border px-3 py-2.5 ${highlight ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20' : 'bg-muted/20'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-amber-700 dark:text-amber-400' : ''}`}>{value || '-'}</p>
    </div>
  );
}
