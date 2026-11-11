import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { LEAVE_BALANCE_ADJUSTMENT_TYPES } from '@/server/validators/leave-balance';
import { createLeaveBalanceAdjustmentAction } from '@/server/actions/leave-balance';
import { LeaveBalanceActions } from '../_components/leave-balance-actions';
import { ArrowLeft, RefreshCw, ShieldPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Leave Balance' };

type Params = Promise<{ employeeId: string }>;
type SearchParams = Promise<{ year?: string; success?: string; error?: string }>;

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  CARRY_FORWARD_CORRECTION: 'Carry Forward Correction',
  OPENING_BALANCE_CORRECTION: 'Opening Balance Correction',
  LEAVE_ENCASHMENT_DEDUCTION: 'Leave Encashment Deduction',
};

interface BalanceRow {
  employeeId: string;
  leaveType: string;
  isUnlimited: boolean;
  openingBalance: number;
  approvedTakenDays: number;
  pendingLeaveDays: number;
  availableBalance: number;
  carryForwardDays: number;
  status: 'ACTIVE' | 'LOW_BALANCE' | 'ZERO_BALANCE' | 'NEGATIVE_BALANCE';
}

interface LeaveHistoryItem {
  id: string;
  leaveRequestNo: string;
  date: string;
  fromDate: string;
  toDate: string;
  leaveType: string;
  days: number;
  status: string;
  balanceAfter: number | null;
}

interface BalanceTransactionItem {
  id: string;
  date: string;
  leaveType: string;
  action: string;
  days: number;
  updatedBy: string;
  remarks: string;
  balanceAfter: number | null;
}

interface AdjustmentRecord {
  id: string;
  adjustmentNo: string;
  employeeId: string;
  leaveType: string;
  leaveYear: number;
  adjustmentType: string;
  days: number;
  reason: string;
  attachmentPath: string | null;
  effectiveDate: string;
  adjustedById: string | null;
  adjustedByName: string | null;
  createdAt: string;
  employee: { id: string; code: string; name: string; branchName: string };
}

interface EmployeeBalanceDetail {
  employee: {
    id: string;
    code: string;
    name: string;
    branchName: string;
    department: string | null;
    designation: string | null;
    employmentType: string | null;
    joiningDate: string;
    status: string;
  };
  leavePolicy: string;
  year: number;
  rows: BalanceRow[];
  leaveHistory: LeaveHistoryItem[];
  transactionLog: BalanceTransactionItem[];
  adjustments: AdjustmentRecord[];
}

interface EmployeeBalanceResponse {
  detail: EmployeeBalanceDetail;
  leaveTypes: Array<{ code: string; name: string }>;
}

export default async function EmployeeLeaveBalancePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { employeeId } = await params;
  const sp = await searchParams;
  const year = Number(sp.year || new Date().getUTCFullYear());

  const response = await backendFetch<EmployeeBalanceResponse>(
    `/api/mobile/hr/leave-balance/${employeeId}?year=${year}`,
  ).catch((error) => {
    if (error instanceof BackendApiError && error.status === 404) return null;
    throw error;
  });

  if (!response) notFound();
  const { detail, leaveTypes } = response;

  const returnPath = `/hr/leave-balance/${employeeId}?year=${year}`;
  const filteredLeaveTypes = leaveTypes.filter((leaveType) =>
    detail.rows.some((row) => row.leaveType === leaveType.code),
  );

  const exportRows = detail.rows.map((row) => ({
    leaveType: labelize(row.leaveType),
    entitled: formatDays(row),
    used: row.approvedTakenDays,
    pending: row.pendingLeaveDays,
    available: formatAvailable(row),
    carryForward: row.carryForwardDays,
    status: statusLabel(row.status),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Leave Balance"
        description="Inspect the generated leave balance, request history, and audit trail for a single employee."
      >
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/hr/leave-balance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={returnPath}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Balance
            </Link>
          </Button>
        </div>
      </PageHeader>

      {sp.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {sp.success}
        </div>
      ) : null}
      {sp.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {sp.error}
        </div>
      ) : null}

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="Employee ID" value={detail.employee.code} />
          <InfoItem label="Employee Name" value={detail.employee.name} />
          <InfoItem label="Department" value={detail.employee.department || '—'} />

          <InfoItem label="Designation" value={detail.employee.designation || '—'} />
          <InfoItem label="Branch" value={detail.employee.branchName} />
          <InfoItem label="Leave Policy" value={detail.leavePolicy} />
          <InfoItem label="Year" value={String(detail.year)} />
          <InfoItem label="Status" value={detail.employee.status} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {detail.rows.map((row) => (
          <Card key={row.leaveType} className="border border-slate-200 dark:border-slate-800">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {labelize(row.leaveType)}
                </div>
                <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <QuickMetric label="Entitled" value={formatDays(row)} />
                <QuickMetric label="Used" value={String(row.approvedTakenDays)} />
                <QuickMetric label="Available" value={formatAvailable(row)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Leave Balance Table
            </CardTitle>
            <LeaveBalanceActions
              filename={`employee-leave-balance-${detail.employee.code}-${detail.year}.csv`}
              rows={exportRows}
              columns={[
                { key: 'leaveType', label: 'Leave Type' },
                { key: 'entitled', label: 'Entitled' },
                { key: 'used', label: 'Used' },
                { key: 'pending', label: 'Pending' },
                { key: 'available', label: 'Available' },
                { key: 'carryForward', label: 'Carry Forward' },
                { key: 'status', label: 'Status' },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Available = Entitled + Carry Forward - Used - Pending
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3 text-left">Leave Type</th>
                  <th className="px-4 py-3 text-right">Entitled</th>
                  <th className="px-4 py-3 text-right">Used</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Carry Forward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detail.rows.map((row) => (
                  <tr key={row.leaveType}>
                    <td className="px-4 py-3 font-medium">{labelize(row.leaveType)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDays(row)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.approvedTakenDays}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.pendingLeaveDays}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatAvailable(row)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.carryForwardDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Leave History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Leave Type</th>
                    <th className="px-4 py-3 text-right">Days</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {detail.leaveHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        No leave requests recorded for this employee in {detail.year}.
                      </td>
                    </tr>
                  ) : (
                    detail.leaveHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{formatShortDate(item.date)}</td>
                        <td className="px-4 py-3">{labelize(item.leaveType)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{item.days}</td>
                        <td className="px-4 py-3">
                          <Badge variant={item.status === 'APPROVED' ? 'success' : 'outline'}>
                            {statusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {item.balanceAfter == null ? 'Unlimited' : item.balanceAfter}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Transaction Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.transactionLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transaction log items recorded yet.</p>
            ) : (
              detail.transactionLog.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatShortDate(item.date)} · {labelize(item.leaveType)} · {item.updatedBy}
                      </p>
                    </div>
                    <Badge variant={item.days >= 0 ? 'success' : 'destructive'}>
                      {item.days >= 0 ? '+' : ''}{item.days}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                    <span>{item.remarks}</span>
                    <span>
                      Balance After: {item.balanceAfter == null ? 'Unlimited' : item.balanceAfter}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <ShieldPlus className="h-4 w-4" />
              Controlled Balance Correction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This screen is not for manually entering leave days. Use corrections only for carry forward, opening
              balance fixes, or leave encashment with a clear reason.
            </div>
            <form action={createLeaveBalanceAdjustmentAction} className="space-y-4">
              <input type="hidden" name="employeeId" value={detail.employee.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ReadOnlyField label="Employee" value={`${detail.employee.code} · ${detail.employee.name}`} />
                <SelectField
                  label="Leave Type"
                  name="leaveType"
                  defaultValue={filteredLeaveTypes[0]?.code ?? ''}
                  options={filteredLeaveTypes.map((leaveType) => ({
                    value: leaveType.code,
                    label: leaveType.name,
                  }))}
                />
                <SelectField
                  label="Adjustment Type"
                  name="adjustmentType"
                  defaultValue=""
                  options={LEAVE_BALANCE_ADJUSTMENT_TYPES.map((type) => ({
                    value: type,
                    label: ADJUSTMENT_TYPE_LABELS[type] ?? type,
                  }))}
                />
                <Field label="Adjustment Days" name="adjustmentDays" type="number" step="0.5" required />
                <ReadOnlyField label="Branch" value={detail.employee.branchName} />
                <SelectField
                  label="Leave Year"
                  name="leaveYear"
                  defaultValue={String(detail.year)}
                  options={[{ value: String(detail.year), label: String(detail.year) }]}
                />
                <Field label="Attachment URL / Path" name="attachmentPath" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reason
                </Label>
                <textarea
                  id="reason"
                  name="reason"
                  required
                  rows={4}
                  className="flex min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save Adjustment</Button>
                <Button type="reset" variant="outline">Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Adjustment Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No manual adjustments recorded yet.</p>
            ) : (
              detail.adjustments.map((adjustment) => (
                <div key={adjustment.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{adjustment.adjustmentNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType] ?? adjustment.adjustmentType} · {adjustment.adjustedByName ?? 'System'}
                      </p>
                    </div>
                    <Badge variant={adjustment.days >= 0 ? 'success' : 'destructive'}>
                      {adjustment.days >= 0 ? '+' : ''}{adjustment.days}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {labelize(adjustment.leaveType)} · {adjustment.leaveYear}
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{adjustment.reason}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  step,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-800 dark:bg-slate-900/20">
        {value}
      </div>
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
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
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
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatDays(row: BalanceRow) {
  return row.isUnlimited ? 'Unlimited' : String(row.openingBalance);
}

function formatAvailable(row: BalanceRow) {
  return row.isUnlimited ? 'Unlimited' : String(row.availableBalance);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusVariant(status: string) {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'success' as const;
  if (status === 'LOW_BALANCE') return 'warning' as const;
  if (status === 'ZERO_BALANCE' || status.startsWith('PENDING')) return 'outline' as const;
  return 'destructive' as const;
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
