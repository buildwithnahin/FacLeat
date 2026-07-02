'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  Clock, Download, FileText, Printer, Search, RotateCcw, Zap, CheckCircle2,
  XCircle, Send, Ban, Eye, Users, Timer, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateOvertimeAction, overtimeStatusAction } from '@/server/actions/overtime';
import type { OtFormState } from '@/server/actions/overtime';
import {
  OVERTIME_TYPE_LABELS, OVERTIME_STATUS_LABELS,
  OVERTIME_RATE_TYPE_LABELS, OVERTIME_SOURCE_LABELS,
  OVERTIME_TYPES, OVERTIME_RATE_TYPES,
} from '@/server/validators/overtime';

type SelectOption = { id: string; label: string };

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary';

function statusVariant(status: string) {
  if (status === 'APPROVED' || status === 'POSTED_TO_PAYROLL') return 'success' as const;
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive' as const;
  if (status.startsWith('PENDING')) return 'warning' as const;
  return 'outline' as const;
}

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ─── Page Header ───────────────────────────────────────────────────────── */
export function OvertimePageHeader() {
  return (
    <div className="flex items-start justify-between gap-4 mb-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/20">
          <Timer className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overtime Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate, approve, and post overtime to payroll
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary Cards ─────────────────────────────────────────────────────── */
export function OvertimeSummaryCards({ summary }: {
  summary: {
    total: number; draft: number; pendingApproval: number;
    approved: number; posted: number; totalAmount: string;
  };
}) {
  const cards = [
    { label: 'Total Records', value: summary.total, icon: Users, gradient: 'from-slate-500 to-slate-700' },
    { label: 'Draft', value: summary.draft, icon: FileText, gradient: 'from-blue-500 to-blue-700' },
    { label: 'Pending Approval', value: summary.pendingApproval, icon: Clock, gradient: 'from-amber-500 to-amber-700' },
    { label: 'Approved', value: summary.approved, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-700' },
    { label: 'Posted to Payroll', value: summary.posted, icon: ArrowUpRight, gradient: 'from-violet-500 to-violet-700' },
    { label: 'Total OT Amount', value: summary.totalAmount, icon: Zap, gradient: 'from-rose-500 to-rose-700', isAmount: true },
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
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.gradient} shadow-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {card.isAmount ? `৳${card.value}` : card.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Generate OT Form ──────────────────────────────────────────────────── */
export function OvertimeGenerateForm({
  branches, departments, shifts, employees, defaultDate,
}: {
  branches: SelectOption[];
  departments: SelectOption[];
  shifts: SelectOption[];
  employees: SelectOption[];
  defaultDate: string;
}) {
  const [state, formAction, isPending] = useActionState(generateOvertimeAction, undefined as OtFormState);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Zap className="h-4 w-4 text-primary" />
          Generate Overtime from Attendance
        </div>
        {state?.error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</div>
        )}
        {state?.success && (
          <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
            Generated {state.generatedCount} overtime record{state.generatedCount !== 1 ? 's' : ''} successfully.
          </div>
        )}
        <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="gen-date" className="text-xs font-medium">Date <span className="text-destructive">*</span></Label>
            <Input id="gen-date" name="date" type="date" required defaultValue={defaultDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-branch" className="text-xs font-medium">Branch <span className="text-destructive">*</span></Label>
            <select id="gen-branch" name="branchId" required className={selectClass}>
              <option value="">Select Branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-dept" className="text-xs font-medium">Department</Label>
            <select id="gen-dept" name="department" className={selectClass}>
              <option value="">All</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-shift" className="text-xs font-medium">Shift</Label>
            <select id="gen-shift" name="shiftId" className={selectClass}>
              <option value="">All</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-emp" className="text-xs font-medium">Employee</Label>
            <select id="gen-emp" name="employeeId" className={selectClass}>
              <option value="">All Employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-type" className="text-xs font-medium">OT Type</Label>
            <select id="gen-type" name="otType" defaultValue="REGULAR" className={selectClass}>
              {OVERTIME_TYPES.map((t) => <option key={t} value={t}>{OVERTIME_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-rateType" className="text-xs font-medium">Rate Type</Label>
            <select id="gen-rateType" name="otRateType" defaultValue="FIXED_RATE" className={selectClass}>
              {OVERTIME_RATE_TYPES.map((t) => <option key={t} value={t}>{OVERTIME_RATE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-rate" className="text-xs font-medium">OT Rate / Hour (৳)</Label>
            <Input id="gen-rate" name="otRatePerHour" type="number" step="0.01" defaultValue="0" />
          </div>
          <div className="xl:col-span-4 pt-2 border-t border-border/40">
            <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-primary to-primary/80 shadow-sm">
              <Zap className="mr-2 h-4 w-4" />
              {isPending ? 'Generating...' : 'Generate OT from Attendance'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── OT Records Table ──────────────────────────────────────────────────── */
export type OtRow = {
  id: string;
  otNumber: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string;
  shiftName: string;
  checkOut: string;
  extraHours: string;
  approvedHours: string;
  otAmount: string;
  managerStatus: string;
  hrStatus: string;
  accountsStatus: string;
  status: string;
  source: string;
  otType: string;
};

export function OvertimeTable({ rows, selectedId }: { rows: OtRow[]; selectedId?: string }) {
  if (rows.length === 0) {
    return (
      <Card className="border-border/50">
        <div className="px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
            <Timer className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No overtime records found</p>
          <p className="text-xs text-muted-foreground mt-1">Generate OT from attendance or create manually</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Timer className="h-4 w-4 text-primary" />
          Overtime Records
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{rows.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">OT No</th>
              <th className="px-4 py-3 text-left font-semibold">Employee</th>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">OT Hours</th>
              <th className="px-4 py-3 text-right font-semibold">Amount (৳)</th>
              <th className="px-4 py-3 text-center font-semibold">Manager</th>
              <th className="px-4 py-3 text-center font-semibold">HR</th>
              <th className="px-4 py-3 text-center font-semibold">Accounts</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className={selectedId === row.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/20 transition-colors'}>
                <td className="px-4 py-3 font-mono text-xs font-medium">{row.otNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.employeeCode}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.date}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                    {row.approvedHours}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{row.otAmount}</td>
                <td className="px-4 py-3 text-center"><ApprovalDot status={row.managerStatus} /></td>
                <td className="px-4 py-3 text-center"><ApprovalDot status={row.hrStatus} /></td>
                <td className="px-4 py-3 text-center"><ApprovalDot status={row.accountsStatus} /></td>
                <td className="px-4 py-3"><Badge variant={statusVariant(row.status)}>{OVERTIME_STATUS_LABELS[row.status] ?? row.status}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                      <Link href={`/hr/overtime?detail=${row.id}`}><Eye className="mr-1 h-3.5 w-3.5" />View</Link>
                    </Button>
                    {row.status === 'DRAFT' && (
                      <form action={overtimeStatusAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="action" value="submit" />
                        <Button variant="ghost" size="sm" type="submit" className="h-7 text-xs text-primary">
                          <Send className="mr-1 h-3.5 w-3.5" />Submit
                        </Button>
                      </form>
                    )}
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

function ApprovalDot({ status }: { status: string }) {
  if (!status || status === '-') return <span className="text-muted-foreground">—</span>;
  if (status === 'APPROVED' || status === 'VERIFIED') return <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />;
  if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-destructive mx-auto" />;
  return <Clock className="h-4 w-4 text-amber-500 mx-auto" />;
}

/* ─── Detail Panel ──────────────────────────────────────────────────────── */
export function OvertimeDetailPanel({ record }: {
  record: {
    id: string; otNumber: string; status: string; otType: string; source: string;
    employeeName: string; employeeCode: string; department: string; designation: string;
    shiftName: string; shiftStart: string; shiftEnd: string;
    date: string; checkIn: string; checkOut: string;
    totalWorkedMinutes: number; regularDutyMinutes: number; breakMinutes: number;
    extraWorkedMinutes: number; lateMinutes: number; earlyExitMinutes: number;
    eligibleOtMinutes: number; approvedOtMinutes: number;
    otRateType: string; otRatePerHour: string; otAmount: string;
    managerStatus: string; managerRemarks: string;
    hrStatus: string; hrRemarks: string;
    accountsStatus: string; accountsRemarks: string;
    remarks: string;
  };
}) {
  const r = record;
  const isManagerPending = r.status === 'PENDING_MANAGER';
  const isHrPending = r.status === 'PENDING_HR';
  const isAccountsPending = r.status === 'PENDING_ACCOUNTS';
  const isApproved = r.status === 'APPROVED';

  return (
    <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="h-4 w-4 text-primary" />
            {r.otNumber} — Overtime Details
          </div>
          <Badge variant={statusVariant(r.status)}>{OVERTIME_STATUS_LABELS[r.status] ?? r.status}</Badge>
        </div>

        {/* Employee + Attendance Info */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RoField label="Employee" value={`${r.employeeName} (${r.employeeCode})`} />
          <RoField label="Department" value={r.department} />
          <RoField label="Designation" value={r.designation} />
          <RoField label="Shift" value={`${r.shiftName} (${r.shiftStart} - ${r.shiftEnd})`} />
          <RoField label="Date" value={r.date} />
          <RoField label="Check In" value={r.checkIn} />
          <RoField label="Check Out" value={r.checkOut} />
          <RoField label="OT Type" value={OVERTIME_TYPE_LABELS[r.otType] ?? r.otType} />
          <RoField label="Total Worked" value={fmtMinutes(r.totalWorkedMinutes)} />
          <RoField label="Regular Duty" value={fmtMinutes(r.regularDutyMinutes)} />
          <RoField label="Break" value={fmtMinutes(r.breakMinutes)} />
          <RoField label="Extra Worked" value={fmtMinutes(r.extraWorkedMinutes)} highlight />
          <RoField label="Eligible OT" value={fmtMinutes(r.eligibleOtMinutes)} />
          <RoField label="Approved OT" value={fmtMinutes(r.approvedOtMinutes)} highlight />
          <RoField label="Rate Type" value={OVERTIME_RATE_TYPE_LABELS[r.otRateType] ?? r.otRateType} />
          <RoField label="OT Amount" value={`৳ ${r.otAmount}`} highlight />
        </div>

        {/* Approval sections with action buttons */}
        {isManagerPending && (
          <ApprovalSection title="Manager Approval" icon={<CheckCircle2 className="h-4 w-4" />}
            id={r.id} approveAction="manager-approve" rejectAction="manager-reject" sendBackAction="manager-sendback"
            minutesField="approvedOtMinutes" currentMinutes={r.approvedOtMinutes} />
        )}
        {r.managerStatus && !isManagerPending && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Manager Decision</p>
            <Badge variant={r.managerStatus === 'APPROVED' ? 'success' : 'destructive'}>{r.managerStatus}</Badge>
            {r.managerRemarks && <p className="text-sm text-muted-foreground mt-1">{r.managerRemarks}</p>}
          </div>
        )}

        {isHrPending && (
          <ApprovalSection title="HR Verification" icon={<CheckCircle2 className="h-4 w-4" />}
            id={r.id} approveAction="hr-verify" rejectAction="hr-reject" sendBackAction="hr-sendback"
            minutesField="verifiedMinutes" currentMinutes={r.approvedOtMinutes}
            approveLabel="Verify" />
        )}
        {r.hrStatus && !isHrPending && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">HR Verification</p>
            <Badge variant={r.hrStatus === 'VERIFIED' ? 'success' : 'destructive'}>{r.hrStatus}</Badge>
            {r.hrRemarks && <p className="text-sm text-muted-foreground mt-1">{r.hrRemarks}</p>}
          </div>
        )}

        {isAccountsPending && (
          <ApprovalSection title="Accounts Approval" icon={<CheckCircle2 className="h-4 w-4" />}
            id={r.id} approveAction="accounts-approve" rejectAction="accounts-reject" sendBackAction="accounts-correction"
            showRateField approveLabel="Approve for Payroll" sendBackLabel="Request Correction" />
        )}
        {r.accountsStatus && !isAccountsPending && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Accounts Decision</p>
            <Badge variant={r.accountsStatus === 'APPROVED' ? 'success' : 'destructive'}>{r.accountsStatus}</Badge>
            {r.accountsRemarks && <p className="text-sm text-muted-foreground mt-1">{r.accountsRemarks}</p>}
          </div>
        )}

        {/* Post to Payroll */}
        {isApproved && (
          <div className="flex gap-3 pt-4 border-t border-border/40">
            <form action={overtimeStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="post-payroll" />
              <Button type="submit" className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm">
                <ArrowUpRight className="mr-2 h-4 w-4" /> Post to Payroll
              </Button>
            </form>
          </div>
        )}

        {/* Cancel button for non-final statuses */}
        {!['POSTED_TO_PAYROLL', 'CANCELLED'].includes(r.status) && (
          <div className="flex gap-3 pt-2">
            <form action={overtimeStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="cancel" />
              <Button type="submit" variant="outline" size="sm" className="text-destructive">
                <Ban className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalSection({
  title, icon, id, approveAction, rejectAction, sendBackAction,
  minutesField, currentMinutes, showRateField, approveLabel, sendBackLabel,
}: {
  title: string; icon: React.ReactNode; id: string;
  approveAction: string; rejectAction: string; sendBackAction: string;
  minutesField?: string; currentMinutes?: number; showRateField?: boolean;
  approveLabel?: string; sendBackLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {minutesField && (
          <div className="space-y-1">
            <Label className="text-xs">Approved Minutes</Label>
            <Input name={minutesField} type="number" defaultValue={currentMinutes} form={`form-${approveAction}`} />
          </div>
        )}
        {showRateField && (
          <div className="space-y-1">
            <Label className="text-xs">OT Rate (৳/hr)</Label>
            <Input name="otRate" type="number" step="0.01" form={`form-${approveAction}`} />
          </div>
        )}
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Remarks</Label>
          <Input name="remarks" form={`form-${approveAction}`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <form id={`form-${approveAction}`} action={overtimeStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value={approveAction} />
          <Button type="submit" size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{approveLabel ?? 'Approve'}
          </Button>
        </form>
        <form action={overtimeStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value={rejectAction} />
          <Button type="submit" size="sm" variant="destructive"><XCircle className="mr-1 h-3.5 w-3.5" />Reject</Button>
        </form>
        <form action={overtimeStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value={sendBackAction} />
          <Button type="submit" size="sm" variant="outline"><ChevronRight className="mr-1 h-3.5 w-3.5" />{sendBackLabel ?? 'Send Back'}</Button>
        </form>
      </div>
    </div>
  );
}

function RoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`space-y-1 rounded-lg border px-3 py-2.5 ${highlight ? 'border-violet-200 bg-violet-50/50 dark:border-violet-900/30 dark:bg-violet-950/20' : 'bg-muted/20'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-violet-700 dark:text-violet-400' : ''}`}>{value || '-'}</p>
    </div>
  );
}
