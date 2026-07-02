import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { prisma } from '@/server/db';
import { LEAVE_TYPES } from '@/server/validators/hr';
import { leaveBalanceService } from '@/server/services/leave-balance.service';
import { createLeaveBalanceAdjustmentAction } from '@/server/actions/leave-balance';
import { LeaveBalanceActions } from './_components/leave-balance-actions';
import { RotateCcw, ShieldPlus } from 'lucide-react';

export const metadata = { title: 'Leave Balance' };

type SearchParams = Promise<{
  year?: string;
  branchId?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  leaveType?: string;
  balanceStatus?: string;
  success?: string;
  error?: string;
}>;

const BALANCE_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LOW_BALANCE', label: 'Low Balance' },
  { value: 'ZERO_BALANCE', label: 'Zero Balance' },
  { value: 'NEGATIVE_BALANCE', label: 'Negative Balance' },
] as const;

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  ADD_LEAVE: 'Add Leave',
  DEDUCT_LEAVE: 'Deduct Leave',
  CARRY_FORWARD_CORRECTION: 'Carry Forward Correction',
  OPENING_BALANCE_CORRECTION: 'Opening Balance Correction',
  SPECIAL_LEAVE_ADD: 'Special Leave Add',
  LEAVE_ENCASHMENT_DEDUCTION: 'Leave Encashment Deduction',
};

export default async function LeaveBalancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const currentYear = new Date().getUTCFullYear();

  const filters = {
    year: Number(sp.year || currentYear),
    branchId: sp.branchId || '',
    department: sp.department || '',
    designation: sp.designation || '',
    employeeId: sp.employeeId || '',
    leaveType: sp.leaveType || '',
    balanceStatus: sp.balanceStatus || '',
    success: sp.success || '',
    error: sp.error || '',
  };

  const [branches, employees, rows, adjustments] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
      },
      orderBy: [{ code: 'asc' }],
    }),
    leaveBalanceService.listBalances(session, {
      year: filters.year,
      branchId: filters.branchId || undefined,
      department: filters.department || undefined,
      designation: filters.designation || undefined,
      employeeId: filters.employeeId || undefined,
      leaveType: filters.leaveType || undefined,
      balanceStatus: filters.balanceStatus || undefined,
    }),
    leaveBalanceService.listAdjustmentHistory(session, {
      year: filters.year,
      branchId: filters.branchId || undefined,
      employeeId: filters.employeeId || undefined,
      leaveType: filters.leaveType || undefined,
    }),
  ]);

  const departmentOptions = Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
  const designationOptions = Array.from(new Set(employees.map((employee) => employee.designation).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );

  const totalEmployees = new Set(rows.map((row) => row.employeeId)).size;
  const totalEntitledLeave = rows.reduce((sum, row) => sum + row.entitledDays, 0);
  const usedLeave = rows.reduce((sum, row) => sum + row.approvedTakenDays, 0);
  const pendingLeave = rows.reduce((sum, row) => sum + row.pendingLeaveDays, 0);
  const availableLeave = rows.reduce((sum, row) => sum + row.availableBalance, 0);
  const negativeBalanceEmployees = new Set(rows.filter((row) => row.status === 'NEGATIVE_BALANCE').map((row) => row.employeeId)).size;

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Balance"
        description="Track employee-wise leave entitlement, usage, carry forward, and HR adjustments."
      >
        <Button asChild variant="outline">
          <Link href="/hr/leaves">Leave Application</Link>
        </Button>
      </PageHeader>

      {filters.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {filters.success}
        </div>
      ) : null}
      {filters.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {filters.error}
        </div>
      ) : null}

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Leave Balance Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Year"
                name="year"
                defaultValue={String(filters.year)}
                options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
              />
              <SelectField
                label="Branch"
                name="branchId"
                defaultValue={filters.branchId}
                options={branches.map((branch) => ({ value: branch.id, label: `${branch.code} · ${branch.name}` }))}
              />
              <SelectField
                label="Department"
                name="department"
                defaultValue={filters.department}
                options={departmentOptions.map((department) => ({ value: department, label: department }))}
              />
              <SelectField
                label="Designation"
                name="designation"
                defaultValue={filters.designation}
                options={designationOptions.map((designation) => ({ value: designation, label: designation }))}
              />
              <SelectField
                label="Employee"
                name="employeeId"
                defaultValue={filters.employeeId}
                options={employees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
                }))}
              />
              <SelectField
                label="Leave Type"
                name="leaveType"
                defaultValue={filters.leaveType}
                options={LEAVE_TYPES.map((leaveType) => ({
                  value: leaveType,
                  label: leaveType.replaceAll('_', ' '),
                }))}
              />
              <SelectField
                label="Balance Status"
                name="balanceStatus"
                defaultValue={filters.balanceStatus}
                options={BALANCE_STATUS_OPTIONS.map((status) => ({ value: status.value, label: status.label }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/leave-balance">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Link>
              </Button>
              <LeaveBalanceActions rows={rows} />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Total Employees" value={String(totalEmployees)} />
        <SummaryCard title="Total Entitled Leave" value={`${totalEntitledLeave} Days`} />
        <SummaryCard title="Used Leave" value={`${usedLeave} Days`} />
        <SummaryCard title="Pending Leave" value={`${pendingLeave} Days`} />
        <SummaryCard title="Available Leave" value={`${availableLeave} Days`} />
        <SummaryCard title="Negative Balance" value={`${negativeBalanceEmployees} Employees`} tone="text-rose-600 dark:text-rose-400" />
      </div>

      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Leave Balance Table
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3 text-left">Employee Code</th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Leave Type</th>
                  <th className="px-4 py-3 text-right">Entitled</th>
                  <th className="px-4 py-3 text-right">Taken</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Adjusted</th>
                  <th className="px-4 py-3 text-right">Carry Forward</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                      No leave balance rows found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.employeeId}-${row.leaveType}`} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.employeeCode}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.designation || '—'} · {row.branchName}
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.department || '—'}</td>
                      <td className="px-4 py-3">{row.leaveType.replaceAll('_', ' ')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.entitledDays}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.approvedTakenDays}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.pendingLeaveDays}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.manualAdjustmentDays}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.carryForwardDays}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{row.availableBalance}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <ShieldPlus className="h-4 w-4" />
              HR Manual Adjustment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createLeaveBalanceAdjustmentAction} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Employee"
                  name="employeeId"
                  defaultValue={filters.employeeId}
                  options={employees.map((employee) => ({
                    value: employee.id,
                    label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
                  }))}
                />
                <SelectField
                  label="Leave Type"
                  name="leaveType"
                  defaultValue={filters.leaveType}
                  options={LEAVE_TYPES.map((leaveType) => ({
                    value: leaveType,
                    label: leaveType.replaceAll('_', ' '),
                  }))}
                />
                <SelectField
                  label="Adjustment Type"
                  name="adjustmentType"
                  defaultValue=""
                  options={leaveBalanceService.adjustmentTypes.map((type) => ({
                    value: type,
                    label: ADJUSTMENT_TYPE_LABELS[type] ?? type,
                  }))}
                />
                <Field label="Adjustment Days" name="adjustmentDays" type="number" step="0.5" required />
                <SelectField
                  label="Leave Year"
                  name="leaveYear"
                  defaultValue={String(filters.year)}
                  options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
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
              Adjustment History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave balance adjustments recorded yet.</p>
            ) : (
              adjustments.map((adjustment) => (
                <div key={adjustment.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{adjustment.adjustmentNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {adjustment.employee.code} · {adjustment.employee.name}
                      </p>
                    </div>
                    <Badge variant={adjustment.days >= 0 ? 'success' : 'destructive'}>
                      {adjustment.days >= 0 ? '+' : ''}{adjustment.days}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType] ?? adjustment.adjustmentType} · {adjustment.leaveType.replaceAll('_', ' ')} · {adjustment.leaveYear}
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

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold text-slate-900 dark:text-slate-100 ${tone ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
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
      <Input id={name} name={name} type={type} step={step} required={required} />
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

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'LOW_BALANCE') return 'warning' as const;
  if (status === 'ZERO_BALANCE') return 'outline' as const;
  return 'destructive' as const;
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
