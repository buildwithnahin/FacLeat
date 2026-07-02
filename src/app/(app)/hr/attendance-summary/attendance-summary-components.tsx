'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  CalendarDays, FileText, Download, Search, CheckCircle2,
  XCircle, Send, AlertTriangle, Eye, Users, RefreshCw, Lock, Unlock, FileSpreadsheet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  generateAttendanceSummaryAction,
  singleSummaryAction,
  recalculateSummaryAction,
} from '@/server/actions/attendance-summary';
import type { AttSummFormState } from '@/server/actions/attendance-summary';
import { ATTENDANCE_SUMMARY_STATUS_LABELS } from '@/server/validators/attendance-summary';

type SelectOption = { id: string; label: string };

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary';

function statusVariant(status: string) {
  if (status === 'READY_FOR_PAYROLL' || status === 'PAYROLL_PROCESSED') return 'success' as const;
  if (status === 'ADJUSTMENT_REQUIRED' || status === 'CANCELLED') return 'destructive' as const;
  if (status === 'UNDER_REVIEW') return 'warning' as const;
  if (status === 'LOCKED' || status === 'SENT_TO_PAYROLL') return 'default' as const;
  return 'outline' as const;
}

/* ─── Page Header ───────────────────────────────────────────────────────── */
export function AttendanceSummaryHeader() {
  return (
    <div className="flex items-start justify-between gap-4 mb-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-700 shadow-lg shadow-indigo-500/20">
          <CalendarDays className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly Attendance Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review monthly attendance before payroll calculation
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
        </Button>
      </div>
    </div>
  );
}

/* ─── Summary Cards ─────────────────────────────────────────────────────── */
export function AttendanceSummaryCards({ summary }: {
  summary: {
    totalEmployees: number; presentDays: number; absentDays: number;
    leaveDays: number; lateCount: number; earlyExitCount: number;
    totalOtHours: string; payrollReady: number; issueFound: number;
  };
}) {
  const cards = [
    { label: 'Total Employees', value: summary.totalEmployees, icon: Users, color: 'text-slate-600' },
    { label: 'Present Days', value: summary.presentDays, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Absent Days', value: summary.absentDays, icon: XCircle, color: 'text-rose-600' },
    { label: 'Leave Days', value: summary.leaveDays, icon: FileText, color: 'text-blue-600' },
    { label: 'Late Count', value: summary.lateCount, icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Total OT Hours', value: summary.totalOtHours, icon: CalendarDays, color: 'text-violet-600' },
    { label: 'Ready for Payroll', value: summary.payrollReady, icon: Send, color: 'text-emerald-600' },
    { label: 'Issues Found', value: summary.issueFound, icon: AlertTriangle, color: 'text-rose-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-border/50 shadow-sm">
            <CardContent className="p-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-2 ${card.color}`} />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{card.label}</p>
              <p className="text-xl font-bold tabular-nums mt-1">{card.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Generate/Filter Form ──────────────────────────────────────────────── */
export function AttendanceSummaryForm({
  branches, departments, shifts, employees, defaultMonth,
}: {
  branches: SelectOption[]; departments: SelectOption[]; shifts: SelectOption[];
  employees: SelectOption[]; defaultMonth: string;
}) {
  const [state, formAction, isPending] = useActionState(generateAttendanceSummaryAction, undefined as AttSummFormState);

  return (
    <Card className="border-border/50 shadow-sm overflow-visible">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Search className="h-4 w-4 text-primary" /> Generate / Filter Summary
          </div>
        </div>
        {state?.error && <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</div>}
        {state?.success && (
          <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            Generated / Recalculated records for {state.generatedCount} employees successfully.
          </div>
        )}
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Month (YYYY-MM) <span className="text-destructive">*</span></Label>
            <Input 
              name="summaryMonth" 
              type="month" 
              required 
              defaultValue={defaultMonth} 
              className="h-9 cursor-pointer"
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {
                  // Ignore if showPicker is not supported
                }
              }} 
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Branch <span className="text-destructive">*</span></Label>
            <select name="branchId" required className={selectClass}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Department</Label>
            <select name="department" className={selectClass}>
              <option value="">All</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Shift</Label>
            <select name="shiftId" className={selectClass}>
              <option value="">All</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2 xl:col-span-2 flex flex-col justify-end">
            <Button type="submit" disabled={isPending} className="w-full bg-gradient-to-r from-indigo-600 to-blue-700 h-9">
              <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
              {isPending ? 'Processing...' : 'Generate / Recalculate'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Main Table ────────────────────────────────────────────────────────── */
export type SummaryRow = {
  id: string; branchId: string; employeeCode: string; employeeName: string; department: string; designation: string;
  summaryMonth: string; totalCalendarDays: number; weeklyOffDays: number; holidayDays: number;
  workingDays: number; presentDays: number; absentDays: number; leaveDays: number;
  lateDays: number; earlyExitDays: number; totalWorkedHours: string; totalOtHours: string;
  payableDays: string; status: string; isLocked: boolean; sentToPayroll: boolean;
};

export function AttendanceSummaryTable({ rows, selectedId }: { rows: SummaryRow[]; selectedId?: string }) {
  if (rows.length === 0) {
    return (
      <Card className="border-border/50">
        <div className="px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No attendance summaries found</p>
          <p className="text-xs text-muted-foreground mt-1">Select a month and branch to generate.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Summary Records
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Employee</th>
              <th className="px-3 py-3 text-center font-semibold" title="Working Days">WD</th>
              <th className="px-3 py-3 text-center font-semibold" title="Present Days">Pr</th>
              <th className="px-3 py-3 text-center font-semibold" title="Absent Days">Ab</th>
              <th className="px-3 py-3 text-center font-semibold" title="Leave Days">Lv</th>
              <th className="px-3 py-3 text-center font-semibold" title="Late Days">Lt</th>
              <th className="px-3 py-3 text-center font-semibold" title="Early Exit Days">Er</th>
              <th className="px-3 py-3 text-center font-semibold" title="OT Hours">OT</th>
              <th className="px-3 py-3 text-center font-semibold" title="Payable Days">Payable</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className={selectedId === row.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/20'}>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.employeeName}</p>
                  <p className="text-[10px] text-muted-foreground">{row.employeeCode} • {row.department}</p>
                </td>
                <td className="px-3 py-3 text-center font-mono text-xs">{row.workingDays}</td>
                <td className="px-3 py-3 text-center font-mono text-xs text-emerald-600 font-semibold">{row.presentDays}</td>
                <td className="px-3 py-3 text-center font-mono text-xs text-rose-600">{row.absentDays > 0 ? row.absentDays : '-'}</td>
                <td className="px-3 py-3 text-center font-mono text-xs text-blue-600">{row.leaveDays > 0 ? row.leaveDays : '-'}</td>
                <td className="px-3 py-3 text-center font-mono text-xs text-amber-600">{row.lateDays > 0 ? row.lateDays : '-'}</td>
                <td className="px-3 py-3 text-center font-mono text-xs">{row.earlyExitDays > 0 ? row.earlyExitDays : '-'}</td>
                <td className="px-3 py-3 text-center font-mono text-xs text-violet-600 font-semibold">{row.totalOtHours}</td>
                <td className="px-3 py-3 text-center font-mono font-bold">{row.payableDays}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 items-start">
                    <Badge variant={statusVariant(row.status)}>{ATTENDANCE_SUMMARY_STATUS_LABELS[row.status]}</Badge>
                    {row.isLocked && !row.sentToPayroll && <span className="text-[10px] flex items-center text-muted-foreground"><Lock className="mr-1 h-3 w-3"/>Locked</span>}
                    {row.sentToPayroll && <span className="text-[10px] flex items-center text-emerald-600"><Send className="mr-1 h-3 w-3"/>Sent</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                      <Link href={`?detail=${row.id}&summaryMonth=${row.summaryMonth}&branchId=${row.branchId}`}>
                        <Eye className="mr-1 h-3 w-3" /> View
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── Detail Side Panel (rendered below form) ───────────────────────────── */
export function AttendanceSummaryDetailPanel({ record }: { record: SummaryRow }) {
  const isLocked = record.isLocked;
  const isSent = record.sentToPayroll;

  return (
    <Card className="border-indigo-200 bg-indigo-50/30 shadow-sm dark:bg-indigo-950/10 dark:border-indigo-900/30">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-indigo-600" />
            {record.employeeName} ({record.employeeCode}) — {record.summaryMonth}
          </div>
          <div className="flex gap-2">
            <Badge variant={statusVariant(record.status)}>{ATTENDANCE_SUMMARY_STATUS_LABELS[record.status]}</Badge>
            {isLocked && <Badge variant="default" className="bg-slate-700 hover:bg-slate-800"><Lock className="mr-1 h-3 w-3"/> Locked</Badge>}
            {isSent && <Badge variant="success" className="bg-emerald-600"><Send className="mr-1 h-3 w-3"/> Payroll Sent</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatBox label="Calendar Days" value={record.totalCalendarDays} />
          <StatBox label="Weekly Off" value={record.weeklyOffDays} />
          <StatBox label="Holidays" value={record.holidayDays} />
          <StatBox label="Working Days" value={record.workingDays} highlight />
          <StatBox label="Present" value={record.presentDays} color="text-emerald-700" />
          <StatBox label="Absent" value={record.absentDays} color={record.absentDays > 0 ? "text-rose-600" : ""} />
          <StatBox label="Leave" value={record.leaveDays} color="text-blue-600" />
          <StatBox label="Late" value={record.lateDays} color={record.lateDays > 0 ? "text-amber-600" : ""} />
          <StatBox label="Early Exit" value={record.earlyExitDays} />
          <StatBox label="Total Hours" value={record.totalWorkedHours} />
          <StatBox label="OT Hours" value={record.totalOtHours} color="text-violet-700" highlight />
          <StatBox label="Payable Days" value={record.payableDays} highlight color="text-indigo-700 font-bold text-lg" />
        </div>

        {/* Action / Payroll Control Section */}
        <div className="pt-4 border-t border-border flex flex-wrap gap-2">
          {!isLocked && !isSent && (
            <>
              <form action={recalculateSummaryAction}>
                <input type="hidden" name="employeeId" value={record.employeeCode} /> {/* In real app use employee.id, mapped locally in page */}
                <input type="hidden" name="summaryMonth" value={record.summaryMonth} />
                <input type="hidden" name="branchId" value={record.branchId} />
                <Button variant="outline" size="sm" type="submit">
                  <RefreshCw className="mr-2 h-4 w-4" /> Recalculate
                </Button>
              </form>

              <Button variant="outline" size="sm" asChild>
                <Link href="/hr/attendance-adjustment">Attendance Adj.</Link>
              </Button>

              <form action={singleSummaryAction}>
                <input type="hidden" name="id" value={record.id} />
                <input type="hidden" name="action" value="require-adjustment" />
                <Button variant="outline" size="sm" type="submit" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                  <AlertTriangle className="mr-2 h-4 w-4" /> Flag Issue
                </Button>
              </form>

              <form action={singleSummaryAction}>
                <input type="hidden" name="id" value={record.id} />
                <input type="hidden" name="action" value="mark-ready" />
                <Button variant="outline" size="sm" type="submit" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Ready
                </Button>
              </form>
              
              <form action={singleSummaryAction}>
                <input type="hidden" name="id" value={record.id} />
                <input type="hidden" name="action" value="lock" />
                <Button size="sm" type="submit" className="bg-slate-800 text-white hover:bg-slate-900">
                  <Lock className="mr-2 h-4 w-4" /> Lock Attendance
                </Button>
              </form>
            </>
          )}

          {isLocked && !isSent && (
            <>
              <form action={singleSummaryAction}>
                <input type="hidden" name="id" value={record.id} />
                <input type="hidden" name="action" value="unlock" />
                <Button variant="outline" size="sm" type="submit">
                  <Unlock className="mr-2 h-4 w-4" /> Unlock
                </Button>
              </form>

              <form action={singleSummaryAction}>
                <input type="hidden" name="id" value={record.id} />
                <input type="hidden" name="action" value="send-payroll" />
                <Button size="sm" type="submit" className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-white">
                  <Send className="mr-2 h-4 w-4" /> Send to Payroll
                </Button>
              </form>
            </>
          )}

          {isSent && (
            <p className="text-sm text-emerald-700 font-medium flex items-center">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Successfully transferred to Payroll.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, highlight, color }: { label: string, value: string | number, highlight?: boolean, color?: string }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? 'bg-background shadow-sm' : 'bg-muted/30'}`}>
      <div className="text-[10px] uppercase text-muted-foreground font-semibold">{label}</div>
      <div className={`font-mono text-sm mt-1 ${color || ''}`}>{value}</div>
    </div>
  );
}
