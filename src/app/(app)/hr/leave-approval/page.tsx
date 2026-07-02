import Link from 'next/link';
import type { ReactNode } from 'react';
import { getSession } from '@/server/auth/session';
import { PageHeader } from '@/components/shared/page-header';
import { leavesService } from '@/server/services/leaves.service';
import { LeaveTable } from '../leaves/_components/leave-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { prisma } from '@/server/db';
import { LEAVE_TYPES } from '@/server/validators/hr';
import { CheckSquare, AlertCircle, Clock, CheckCheck, XCircle, FileClock, Filter, RotateCcw } from 'lucide-react';
import { ApprovalFilterActions } from './_components/approval-filter-actions';

export const metadata = { title: 'Leave Approvals' };

type SearchParams = Promise<{
  from?: string;
  to?: string;
  branchId?: string;
  department?: string;
  employeeId?: string;
  type?: string;
  status?: string;
  stage?: string;
}>;

type LeaveRow = Awaited<ReturnType<typeof leavesService.list>>[number];

const HISTORY_STATUSES = ['APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'] as const;

export default async function LeaveApprovalPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;

  const filters = {
    from: sp.from || '',
    to: sp.to || '',
    branchId: sp.branchId || '',
    department: sp.department || '',
    employeeId: sp.employeeId || '',
    type: sp.type || '',
    status: sp.status || '',
    stage: sp.stage || '',
  };

  const [branches, employees, allLeaves] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        department: true,
      },
      orderBy: [{ firstName: 'asc' }],
    }),
    leavesService.list(session, {
      branchId: filters.branchId || undefined,
      employeeId: filters.employeeId || undefined,
      department: filters.department || undefined,
      type: filters.type || undefined,
      fromDate: filters.from || undefined,
      toDate: filters.to || undefined,
    }),
  ]);

  const departmentOptions = Array.from(
    new Set(employees.map((employee) => employee.department).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  const filteredLeaves = allLeaves.filter((leave) => {
    if (!filters.status) return true;
    return leave.status === filters.status;
  });

  const queueSource =
    filters.stage === 'manager'
      ? filteredLeaves.filter((leave) => leave.status === 'PENDING_MANAGER')
      : filters.stage === 'hr'
        ? filteredLeaves.filter((leave) => leave.status === 'PENDING_HR')
        : filteredLeaves;

  const managerPending = queueSource.filter((leave) => leave.status === 'PENDING_MANAGER');
  const hrPending = queueSource.filter((leave) => leave.status === 'PENDING_HR');
  const historyLeaves = filteredLeaves.filter((leave) => HISTORY_STATUSES.includes(leave.status as (typeof HISTORY_STATUSES)[number]));

  const [managerPendingWithBalance, hrPendingWithBalance] = await Promise.all([
    attachBalanceSummaries(session, managerPending),
    attachBalanceSummaries(session, hrPending),
  ]);

  const totalPending = managerPending.length + hrPending.length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const approvedToday = allLeaves.filter(
    (leave) => leave.status === 'APPROVED' && leave.hrApprovedAt?.slice(0, 10) === todayIso,
  ).length;
  const rejectedToday = allLeaves.filter((leave) => {
    const decidedOn = leave.hrApprovedAt || leave.managerApprovedAt;
    return leave.status === 'REJECTED' && decidedOn?.slice(0, 10) === todayIso;
  }).length;
  const unpaidPending = allLeaves.filter(
    (leave) => leave.type === 'UNPAID' && ['PENDING_MANAGER', 'PENDING_HR'].includes(leave.status),
  ).length;

  const canManagerDecide = session?.permissions.includes('hr:write') ?? false;
  const canHrDecide = session?.permissions.includes('hr:leave-approve') ?? false;
  const exportRows = [...managerPendingWithBalance, ...hrPendingWithBalance, ...historyLeaves];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Approvals"
        description="Review, verify, approve, and reject submitted leave requests. New requests are created from the Leave Application page."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          title="Pending Manager Approval"
          value={managerPending.length}
          caption="Awaiting line manager review"
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          className="border-amber-200 bg-amber-50/20 dark:border-amber-950 dark:bg-amber-950/10"
          titleClassName="text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          title="Pending HR Verification"
          value={hrPending.length}
          caption="Approved by manager, waiting for HR"
          icon={<CheckSquare className="h-4 w-4 text-indigo-500" />}
          className="border-indigo-200 bg-indigo-50/20 dark:border-indigo-950 dark:bg-indigo-950/10"
          titleClassName="text-indigo-600 dark:text-indigo-400"
        />
        <SummaryCard
          title="Total Active Queue"
          value={totalPending}
          caption="Open requests needing a decision"
          icon={<AlertCircle className="h-4 w-4 text-slate-500" />}
        />
        <SummaryCard
          title="Approved Today"
          value={approvedToday}
          caption="Final approvals recorded today"
          icon={<CheckCheck className="h-4 w-4 text-emerald-500" />}
          className="border-emerald-200 bg-emerald-50/20 dark:border-emerald-950 dark:bg-emerald-950/10"
          titleClassName="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          title="Rejected Today"
          value={rejectedToday}
          caption="Requests rejected today"
          icon={<XCircle className="h-4 w-4 text-rose-500" />}
          className="border-rose-200 bg-rose-50/20 dark:border-rose-950 dark:bg-rose-950/10"
          titleClassName="text-rose-600 dark:text-rose-400"
        />
        <SummaryCard
          title="Unpaid Leave Pending"
          value={unpaidPending}
          caption="Will affect payroll if approved"
          icon={<FileClock className="h-4 w-4 text-orange-500" />}
          className="border-orange-200 bg-orange-50/20 dark:border-orange-950 dark:bg-orange-950/10"
          titleClassName="text-orange-600 dark:text-orange-400"
        />
      </div>

      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Filter className="h-4 w-4" />
            Approval Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="From Date" name="from" type="date" defaultValue={filters.from} />
              <FilterField label="To Date" name="to" type="date" defaultValue={filters.to} />
              <FilterSelect
                label="Branch"
                name="branchId"
                defaultValue={filters.branchId}
                options={branches.map((branch) => ({
                  value: branch.id,
                  label: `${branch.code} · ${branch.name}`,
                }))}
              />
              <FilterSelect
                label="Department"
                name="department"
                defaultValue={filters.department}
                options={departmentOptions.map((department) => ({
                  value: department,
                  label: department,
                }))}
              />
              <FilterSelect
                label="Employee"
                name="employeeId"
                defaultValue={filters.employeeId}
                options={employees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
                }))}
              />
              <FilterSelect
                label="Leave Type"
                name="type"
                defaultValue={filters.type}
                options={LEAVE_TYPES.map((type) => ({
                  value: type,
                  label: type.replaceAll('_', ' '),
                }))}
              />
              <FilterSelect
                label="Status"
                name="status"
                defaultValue={filters.status}
                options={[
                  { value: 'PENDING_MANAGER', label: 'Pending Manager Approval' },
                  { value: 'PENDING_HR', label: 'Pending HR Verification' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                  { value: 'WITHDRAWN', label: 'Withdrawn' },
                ]}
              />
              <FilterSelect
                label="Approval Stage"
                name="stage"
                defaultValue={filters.stage}
                options={[
                  { value: 'manager', label: 'Manager Approval Queue' },
                  { value: 'hr', label: 'HR Verification Queue' },
                  { value: 'history', label: 'History Only' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200">
                Search
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/leave-approval">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Link>
              </Button>
              <ApprovalFilterActions rows={exportRows} />
            </div>
          </form>
        </CardContent>
      </Card>

      {filters.stage !== 'history' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <span>Manager Approval Queue</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {managerPendingWithBalance.length}
                </Badge>
              </h3>
            </div>
            <LeaveTable
              leaves={managerPendingWithBalance}
              mode="approval"
              canManagerDecide={canManagerDecide}
              canHrDecide={canHrDecide}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <span>HR Approval Queue</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {hrPendingWithBalance.length}
                </Badge>
              </h3>
            </div>
            <LeaveTable
              leaves={hrPendingWithBalance}
              mode="approval"
              canManagerDecide={canManagerDecide}
              canHrDecide={canHrDecide}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <span>Leave History / Approved Requests</span>
            <Badge variant="outline" className="text-xs font-mono">
              {historyLeaves.length}
            </Badge>
          </h3>
        </div>
        <LeaveTable leaves={historyLeaves} mode="history" />
      </div>
    </div>
  );
}

async function attachBalanceSummaries(session: Awaited<ReturnType<typeof getSession>>, leaves: LeaveRow[]) {
  const balanceCache = new Map<string, Promise<Awaited<ReturnType<typeof leavesService.getLeaveBalance>>>>();

  return Promise.all(
    leaves.map(async (leave) => {
      const year = new Date(leave.fromDate).getUTCFullYear();
      const cacheKey = `${leave.employeeId}:${year}`;

      if (!balanceCache.has(cacheKey)) {
        balanceCache.set(cacheKey, leavesService.getLeaveBalance(session, leave.employeeId, year));
      }

      const balances = await balanceCache.get(cacheKey)!;
      const typeBalance = balances[leave.type];

      return {
        ...leave,
        balanceSummary: typeBalance
          ? {
              ...typeBalance,
              requested: Number(leave.days),
              balanceAfterApproval: Math.max(0, typeBalance.available - Number(leave.days)),
            }
          : null,
      };
    }),
  );
}

function SummaryCard({
  title,
  value,
  caption,
  icon,
  className,
  titleClassName,
}: {
  title: string;
  value: number;
  caption: string;
  icon: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <Card className={className ?? 'border border-slate-200 dark:border-slate-800'}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-xs font-bold uppercase tracking-wider text-slate-500 ${titleClassName ?? ''}`}>
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

function FilterField({
  label,
  name,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}

function FilterSelect({
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
