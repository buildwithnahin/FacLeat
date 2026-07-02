import Link from 'next/link';
import { CalendarCheck, CalendarClock, CalendarOff, ClipboardList, HandCoins, Sparkles, TrendingUp, UserPlus, Users } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/money';

export const metadata = { title: 'HR & Payroll' };

export default async function HrOverviewPage() {
  const session = await getSession();
  const today = new Date();
  const day = new Date(today.toISOString().slice(0, 10));

  const [employees, attendance, leaves, payrollRuns, recentAudit] = await Promise.all([
    hrService.listEmployees(session),
    hrService.listAttendance(session, { from: day, to: day }),
    hrService.listLeaves(session),
    hrService.listPayrollRuns(session),
    prisma.auditLog.findMany({
      where: { module: 'hr' },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE');
  const presentToday = attendance.filter((record) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(record.status)).length;
  const absentToday = attendance.filter((record) => record.status === 'ABSENT').length;
  const lateToday = attendance.filter((record) => record.status === 'LATE').length;
  const onLeaveToday = leaves.filter(
    (leave) =>
      leave.status === 'APPROVED' &&
      leave.fromDate.getTime() <= day.getTime() &&
      leave.toDate.getTime() >= day.getTime(),
  ).length;
  const pendingLeave = leaves.filter((leave) => ['PENDING_MANAGER', 'PENDING_HR'].includes(leave.status)).length;
  const newJoining = employees.filter((employee) => {
    const joined = employee.joinedAt;
    return joined.getFullYear() === today.getFullYear() && joined.getMonth() === today.getMonth();
  }).length;
  const pendingPayroll = payrollRuns.filter((run) => ['DRAFT', 'APPROVED'].includes(run.status)).length;
  const latestPayroll = payrollRuns[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR & Payroll"
        description="Employee lifecycle, attendance, leave, payroll, and workforce control in one workspace."
      >
        <Badge variant="outline">{today.toISOString().slice(0, 10)}</Badge>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} title="Employees" value={String(employees.length)} subtitle={`${activeEmployees.length} active workforce`} />
        <MetricCard icon={CalendarCheck} title="Present Today" value={String(presentToday)} subtitle={`${lateToday} late attendance`} />
        <MetricCard icon={CalendarOff} title="Pending Leave" value={String(pendingLeave)} subtitle={`${onLeaveToday} on leave today`} />
        <MetricCard
          icon={HandCoins}
          title="Latest Payroll"
          value={latestPayroll ? formatCurrency(latestPayroll.totalNet) : 'Not run'}
          subtitle={latestPayroll ? `${latestPayroll.period} · ${latestPayroll.status}` : `${pendingPayroll} payroll run pending`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">HR Dashboard</h2>
                <p className="text-sm text-muted-foreground">Immediate visibility into workforce status and action items.</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoTile label="Attendance Today" value={String(attendance.length)} helper="Marked records" />
              <InfoTile label="Absent Today" value={String(absentToday)} helper="Recorded absent status" />
              <InfoTile label="New Joining" value={String(newJoining)} helper="Joined this month" />
              <InfoTile label="Pending Payroll" value={String(pendingPayroll)} helper="Draft or approved runs" />
              <InfoTile label="Notifications" value={String(recentAudit.length)} helper="Recent HR activities" />
              <InfoTile label="Lifecycle Scope" value="360°" helper="From hiring to exit" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" />
              Priority Tasks
            </div>
            <div className="space-y-3">
              <TaskRow label="Leave Approval" value={`${pendingLeave} pending`} href="/hr/leave-approval" />
              <TaskRow label="Attendance Correction" value={`${absentToday} absent records`} href="/hr/attendance-adjustment" />
              <TaskRow label="Payroll Processing" value={`${pendingPayroll} run(s) open`} href="/hr/payroll" />
              <TaskRow label="Recruitment Pipeline" value="Start hiring workflow" href="/hr/recruitment" />
              <TaskRow label="Exit Clearance" value="Manage final separation" href="/hr/exit-clearance" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Lifecycle Shortcuts
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <NavCard icon={<Users className="h-5 w-5 text-primary" />} title="Employees" subtitle="360° employee profile and records" href="/hr/employees" />
              <NavCard icon={<UserPlus className="h-5 w-5 text-primary" />} title="Recruitment" subtitle="Request to joining workflow" href="/hr/recruitment" />
              <NavCard icon={<CalendarCheck className="h-5 w-5 text-primary" />} title="Attendance" subtitle="Daily, adjustment, late and overtime" href="/hr/attendance" />
              <NavCard icon={<CalendarClock className="h-5 w-5 text-primary" />} title="Performance" subtitle="KPI, review, and appraisal" href="/hr/performance-review" />
              <NavCard icon={<CalendarOff className="h-5 w-5 text-primary" />} title="Leave" subtitle="Application, approval, and balance" href="/hr/leaves" />
              <NavCard icon={<HandCoins className="h-5 w-5 text-primary" />} title="Payroll" subtitle="Salary structure to payslip" href="/hr/payroll" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" />
              Recent Activities
            </div>
            {recentAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No HR activity has been logged yet.</p>
            ) : (
              <div className="space-y-3">
                {recentAudit.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium capitalize">{item.action.replaceAll('-', ' ')}</p>
                      <Badge variant="outline">{item.entityType}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.createdAt.toISOString().slice(0, 10)} · {item.module}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NavCard({ icon, title, subtitle, href }: { icon: React.ReactNode; title: string; subtitle: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary transition-colors">
        <CardContent className="p-5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">{icon}</div>
          <div>
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

function TaskRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm transition-colors hover:border-primary">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </Link>
  );
}
