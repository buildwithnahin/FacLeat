import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarCheck2, History, TrendingUp, UserRound } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import { NotFoundError } from '@/lib/errors';
import { formatCurrency } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Employee Profile' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive',
  RESIGNED: 'outline',
};

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:read');

  let employee;
  try {
    employee = await hrService.getEmployee(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [attendance, leaves, payrollRuns, documents, audits, workflowRecords] = await Promise.all([
    hrService.listAttendance(session, { employeeId: id }),
    hrService.listLeaves(session, { employeeId: id }),
    prisma.payslip.findMany({
      where: { employeeId: id },
      include: { payrollRun: { include: { branch: true } } },
      orderBy: { payrollRun: { period: 'desc' } },
      take: 6,
    }),
    prisma.documentLink.findMany({
      where: { entityType: 'Employee', entityId: id },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.auditLog.findMany({
      where: { entityType: 'Employee', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    hrService.listWorkflowRecords(session, { employeeId: id }),
  ]);

  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const presentCount = attendance.filter((record) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(record.status)).length;
  const lateCount = attendance.filter((record) => record.status === 'LATE').length;
  const approvedLeaves = leaves.filter((leave) => leave.status === 'APPROVED').reduce((sum, leave) => sum + leave.days, 0);
  const pendingLeaves = leaves.filter((leave) => leave.status === 'PENDING').length;
  const payrollTotal = payrollRuns.reduce((sum, payslip) => sum + Number(payslip.net), 0);

  const timeline = [
    {
      date: employee.joinedAt,
      title: 'Joined company',
      detail: `${employee.firstName} ${employee.lastName} joined ${employee.branch.name}`,
    },
    ...leaves.slice(0, 4).map((leave) => ({
      date: leave.createdAt,
      title: `Leave ${leave.status.toLowerCase()}`,
      detail: `${leave.type} · ${leave.days} day(s)`,
    })),
    ...attendance.slice(0, 4).map((record) => ({
      date: record.date,
      title: 'Attendance recorded',
      detail: `${record.status}${record.checkIn ? ` · In ${record.checkIn.toISOString().slice(11, 16)}` : ''}${record.checkOut ? ` · Out ${record.checkOut.toISOString().slice(11, 16)}` : ''}`,
    })),
    ...payrollRuns.slice(0, 4).map((payslip) => ({
      date: payslip.createdAt,
      title: 'Payroll generated',
      detail: `${payslip.payrollRun.period} · Net ${formatCurrency(payslip.net)}`,
    })),
    ...workflowRecords.slice(0, 8).map((record) => ({
      date: record.updatedAt,
      title: record.title,
      detail: `${record.section.replaceAll('-', ' ')} · ${record.status}`,
    })),
    ...audits.map((audit) => ({
      date: audit.createdAt,
      title: `${audit.action.replaceAll('-', ' ')}`,
      detail: `${audit.module} update`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={`${employee.code} · ${employee.designation ?? 'No designation'} · ${employee.department ?? 'No department'}`}
      >
        <Badge variant={STATUS_VARIANT[employee.status] ?? 'outline'}>{employee.status}</Badge>
        {canWrite && (
          <Button asChild variant="outline">
            <Link href={`/hr/employees/${employee.id}/edit`}>Edit profile</Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={UserRound} label="Present Records" value={String(presentCount)} />
        <SummaryCard icon={History} label="Late Records" value={String(lateCount)} />
        <SummaryCard icon={CalendarCheck2} label="Approved Leave Days" value={String(approvedLeaves)} />
        <SummaryCard icon={TrendingUp} label="Payroll Paid (Recent)" value={formatCurrency(payrollTotal)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Basic Information">
          <InfoRow label="Employee Code" value={employee.code} mono />
          <InfoRow label="Email" value={employee.email ?? '—'} />
          <InfoRow label="Phone" value={employee.phone ?? '—'} />
          <InfoRow label="Status" value={employee.status} />
          <InfoRow label="Joined At" value={employee.joinedAt.toISOString().slice(0, 10)} />
        </SectionCard>

        <SectionCard title="Job Information">
          <InfoRow label="Branch" value={employee.branch.name} />
          <InfoRow label="Department" value={employee.department ?? '—'} />
          <InfoRow label="Designation" value={employee.designation ?? '—'} />
          <InfoRow label="Employment Type" value={employee.employmentType ?? '—'} />
          <InfoRow
            label="Reporting Manager"
            value={employee.reportingManager ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : '—'}
          />
          <InfoRow label="Role" value={employee.systemRole?.name ?? 'No system access role'} />
          <InfoRow label="Shift" value="Not yet configured" />
        </SectionCard>

        <SectionCard title="Salary Information">
          <InfoRow label="Basic Salary" value={formatCurrency(employee.basicSalary)} numeric />
          <InfoRow label="House Allowance" value={formatCurrency(employee.houseAllowance)} numeric />
          <InfoRow label="Transport Allowance" value={formatCurrency(employee.transportAllowance)} numeric />
          <InfoRow label="Medical Allowance" value={formatCurrency(employee.medicalAllowance)} numeric />
          <InfoRow label="Other Allowance" value={formatCurrency(employee.otherAllowance)} numeric />
          <InfoRow label="Provident Fund" value={formatCurrency(employee.providentFund)} numeric />
          <InfoRow label="Tax Deduction" value={formatCurrency(employee.taxDeduction)} numeric />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Documents">
          {documents.length === 0 ? (
            <EmptyState text="No HR documents linked to this employee yet." />
          ) : (
            <ul className="space-y-3">
              {documents.map((link) => (
                <li key={link.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{link.document.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.document.mimeType} · {(link.document.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Badge variant="outline">{link.document.category ?? 'General'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Attendance">
          {attendance.length === 0 ? (
            <EmptyState text="No attendance records available yet." />
          ) : (
            <ul className="space-y-3">
              {attendance.slice(0, 8).map((record) => (
                <li key={record.id} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-lg border p-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{record.date.toISOString().slice(0, 10)}</span>
                  <div className="text-muted-foreground">
                    {record.checkIn ? `In ${record.checkIn.toISOString().slice(11, 16)}` : 'No check-in'}
                    {' · '}
                    {record.checkOut ? `Out ${record.checkOut.toISOString().slice(11, 16)}` : 'No check-out'}
                  </div>
                  <Badge variant={record.status === 'PRESENT' ? 'success' : record.status === 'LATE' ? 'warning' : 'outline'}>
                    {record.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Leave">
          <InfoRow label="Pending Leave Requests" value={String(pendingLeaves)} />
          <InfoRow label="Approved Leave Days" value={String(approvedLeaves)} />
          <div className="mt-4">
            {leaves.length === 0 ? (
              <EmptyState text="No leave history for this employee yet." />
            ) : (
              <ul className="space-y-3">
                {leaves.slice(0, 6).map((leave) => (
                  <li key={leave.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{leave.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {leave.fromDate.toISOString().slice(0, 10)} to {leave.toDate.toISOString().slice(0, 10)} · {leave.days} day(s)
                      </p>
                    </div>
                    <Badge variant={leave.status === 'APPROVED' ? 'success' : leave.status === 'PENDING' ? 'warning' : 'outline'}>
                      {leave.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Payroll">
          {payrollRuns.length === 0 ? (
            <EmptyState text="No payroll history generated yet." />
          ) : (
            <ul className="space-y-3">
              {payrollRuns.map((payslip) => (
                <li key={payslip.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{payslip.payrollRun.period}</p>
                    <p className="text-xs text-muted-foreground">
                      {payslip.payrollRun.branch.name} · Worked {payslip.workedDays} day(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(payslip.net)}</p>
                    <p className="text-xs text-muted-foreground">{payslip.payrollRun.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Training">
          <WorkflowList records={workflowRecords.filter((record) => record.section.startsWith('training-'))} />
        </SectionCard>
        <SectionCard title="Performance">
          <WorkflowList records={workflowRecords.filter((record) => ['performance-review', 'appraisal', 'kpi'].includes(record.section))} />
        </SectionCard>
        <SectionCard title="Promotion History">
          <WorkflowList records={workflowRecords.filter((record) => record.section === 'promotions')} />
        </SectionCard>
        <SectionCard title="Transfer History">
          <WorkflowList records={workflowRecords.filter((record) => record.section === 'transfers')} />
        </SectionCard>
        <SectionCard title="Increment History">
          <WorkflowList records={workflowRecords.filter((record) => record.section === 'increments')} />
        </SectionCard>
        <SectionCard title="Warnings">
          <WorkflowList records={workflowRecords.filter((record) => ['warnings', 'suspensions', 'notices'].includes(record.section))} />
        </SectionCard>
        <SectionCard title="Exit Details">
          <WorkflowList records={workflowRecords.filter((record) => ['resignations', 'exit-clearance', 'final-settlement'].includes(record.section))} />
        </SectionCard>
        <SectionCard title="Activity Timeline">
          {timeline.length === 0 ? (
            <EmptyState text="No timeline events yet." />
          ) : (
            <ol className="space-y-4">
              {timeline.map((item, index) => (
                <li key={`${item.title}-${item.date.toISOString()}-${index}`} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.date.toISOString().slice(0, 10)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase leading-4 tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <h2 className="mb-4 text-sm font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  mono,
  numeric,
}: {
  label: string;
  value: string;
  mono?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-x-4 gap-y-1 py-2 text-sm">
      <span className="leading-6 text-muted-foreground">{label}</span>
      <span
        className={[
          'min-w-0 break-words leading-6 text-foreground',
          mono ? 'font-mono text-xs leading-6' : '',
          numeric ? 'text-right tabular-nums font-medium' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function WorkflowList({
  records,
}: {
  records: Array<{
    id: string;
    section: string;
    title: string;
    subject: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    endDate: Date | null;
    updatedAt: Date;
  }>;
}) {
  if (records.length === 0) return <EmptyState text="No records saved for this employee yet." />;

  return (
    <ul className="space-y-3">
      {records.map((record) => (
        <li key={record.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{record.title}</p>
              <p className="text-xs text-muted-foreground">
                {record.section.replaceAll('-', ' ')}
                {record.subject ? ` · ${record.subject}` : ''}
              </p>
            </div>
            <Badge variant={record.status === 'COMPLETED' || record.status === 'APPROVED' ? 'success' : 'outline'}>
              {record.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {record.startDate ? record.startDate.toISOString().slice(0, 10) : record.updatedAt.toISOString().slice(0, 10)}
            {record.endDate ? ` to ${record.endDate.toISOString().slice(0, 10)}` : ''}
            {' · '}
            {record.priority}
          </p>
        </li>
      ))}
    </ul>
  );
}
