import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { backendFetch } from '@/lib/backend-client';
import { LeaveBalanceActions } from './_components/leave-balance-actions';
import { RotateCcw, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Leave Balance' };

type SearchParams = Promise<{
  q?: string;
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

interface EmployeeSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  leavePolicy: string;
  leaveYear: number;
  leaveTypesCount: number;
  totalEntitledDays: number;
  totalApprovedTakenDays: number;
  totalPendingLeaveDays: number;
  totalCarryForwardDays: number;
  totalEncashedDays: number;
  totalAvailableBalance: number;
  hasUnlimitedBalance: boolean;
  status: 'ACTIVE' | 'LOW_BALANCE' | 'ZERO_BALANCE' | 'NEGATIVE_BALANCE';
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

interface LeaveBalancePageResponse {
  branches: Array<{ id: string; code: string; name: string }>;
  employees: Array<{ id: string; code: string; firstName: string; lastName: string; department: string | null; designation: string | null }>;
  leaveTypes: Array<{ code: string; name: string }>;
  summaries: EmployeeSummary[];
  adjustments: AdjustmentRecord[];
}

export default async function LeaveBalancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const currentYear = new Date().getUTCFullYear();

  const filters = {
    q: sp.q || '',
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

  const listParams = new URLSearchParams();
  if (filters.q) listParams.set('q', filters.q);
  listParams.set('year', String(filters.year));
  if (filters.branchId) listParams.set('branchId', filters.branchId);
  if (filters.department) listParams.set('department', filters.department);
  if (filters.designation) listParams.set('designation', filters.designation);
  if (filters.employeeId) listParams.set('employeeId', filters.employeeId);
  if (filters.leaveType) listParams.set('leaveType', filters.leaveType);
  if (filters.balanceStatus) listParams.set('balanceStatus', filters.balanceStatus);

  const { branches, employees, leaveTypes, summaries, adjustments } = await backendFetch<LeaveBalancePageResponse>(
    `/api/mobile/hr/leave-balance?${listParams.toString()}`,
  );

  const departmentOptions = Array.from(
    new Set(employees.map((employee) => employee.department).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
  const designationOptions = Array.from(
    new Set(employees.map((employee) => employee.designation).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  const totalEmployees = summaries.length;
  const totalEntitledLeave = summaries.reduce((sum, row) => sum + row.totalEntitledDays, 0);
  const usedLeave = summaries.reduce((sum, row) => sum + row.totalApprovedTakenDays, 0);
  const pendingLeave = summaries.reduce((sum, row) => sum + row.totalPendingLeaveDays, 0);
  const negativeBalanceEmployees = summaries.filter((row) => row.status === 'NEGATIVE_BALANCE').length;
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  const queryString = buildQueryString({
    q: filters.q,
    year: String(filters.year),
    branchId: filters.branchId,
    department: filters.department,
    designation: filters.designation,
    employeeId: filters.employeeId,
    leaveType: filters.leaveType,
    balanceStatus: filters.balanceStatus,
  });

  const exportRows = summaries.map((row) => ({
    employeeCode: row.employeeCode,
    employeeName: row.employeeName,
    department: row.department ?? '',
    designation: row.designation ?? '',
    leavePolicy: row.leavePolicy,
    year: row.leaveYear,
    entitled: row.totalEntitledDays,
    used: row.totalApprovedTakenDays,
    pending: row.totalPendingLeaveDays,
    carryForward: row.totalCarryForwardDays,
    available: row.hasUnlimitedBalance ? 'Mixed' : row.totalAvailableBalance,
    status: statusLabel(row.status),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Balance"
        description="Review employee-wise balances generated from leave policy, approvals, and carry forward."
      >
        <Button asChild variant="outline">
          <Link href="/hr/leaves">Leave Application</Link>
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
        Leave balances are system-generated. HR should only correct them through controlled manual adjustments with reasons and audit logs.
      </div>

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
              <TextField label="Search Employee" name="q" defaultValue={filters.q} placeholder="Code or employee name" />
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
                options={leaveTypes.map((leaveType) => ({
                  value: leaveType.code,
                  label: leaveType.name,
                }))}
              />
              <SelectField
                label="Status"
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
              <Button type="button" variant="outline" asChild>
                <Link href={`/hr/leave-balance${queryString ? `?${queryString}` : ''}`}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Balance
                </Link>
              </Button>
              <LeaveBalanceActions
                filename="leave-balance-employee-list.csv"
                rows={exportRows}
                columns={[
                  { key: 'employeeCode', label: 'Employee Code' },
                  { key: 'employeeName', label: 'Employee Name' },
                  { key: 'department', label: 'Department' },
                  { key: 'designation', label: 'Designation' },
                  { key: 'leavePolicy', label: 'Leave Policy' },
                  { key: 'year', label: 'Year' },
                  { key: 'entitled', label: 'Entitled' },
                  { key: 'used', label: 'Used' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'carryForward', label: 'Carry Forward' },
                  { key: 'available', label: 'Available' },
                  { key: 'status', label: 'Status' },
                ]}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Employees" value={String(totalEmployees)} />
        <SummaryCard title="Entitled" value={`${totalEntitledLeave} Days`} />
        <SummaryCard title="Used" value={`${usedLeave} Days`} />
        <SummaryCard title="Pending" value={`${pendingLeave} Days`} />
        <SummaryCard title="Negative Balance" value={`${negativeBalanceEmployees} Employees`} tone="text-rose-600 dark:text-rose-400" />
      </div>

      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Employee Leave Balance List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3 text-left">Employee Code</th>
                  <th className="px-4 py-3 text-left">Employee Name</th>
                  <th className="px-4 py-3 text-left">Department</th>
                  <th className="px-4 py-3 text-left">Year</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No leave balance rows found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  summaries.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.employeeCode}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.designation || '—'} · {row.branchName} · {row.leavePolicy}
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.department || '—'}</td>
                      <td className="px-4 py-3">{row.leaveYear}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={`/hr/leave-balance/${row.employeeId}?year=${row.leaveYear}`}>View</Link>
                        </Button>
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
            Recent Adjustment Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave balance adjustments recorded yet.</p>
          ) : (
            adjustments.slice(0, 8).map((adjustment) => (
              <div key={adjustment.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{adjustment.adjustmentNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {adjustment.employee.code} · {adjustment.employee.name} · {adjustment.adjustedByName ?? 'System'}
                    </p>
                  </div>
                  <Badge variant={adjustment.days >= 0 ? 'success' : 'destructive'}>
                    {adjustment.days >= 0 ? '+' : ''}{adjustment.days}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {adjustment.leaveType.replaceAll('_', ' ')} · {adjustment.leaveYear}
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{adjustment.reason}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return params.toString();
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

function TextField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} />
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
