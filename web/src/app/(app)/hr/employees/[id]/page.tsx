import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarCheck2, History, TrendingUp, UserRound } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Profile' };

// Kept in sync with the root validators (src/server/validators/{confirmations,increments,promotions,transfers}.ts)
// — those files belong to the HR-Lifecycle sub-area's migration, so only the
// small display label maps are duplicated here rather than importing across
// sub-area boundaries.
const CONFIRMATION_TYPE_LABELS: Record<string, string> = {
  PROBATION_TO_PERMANENT: 'Probation to Permanent',
  INTERNSHIP_TO_PERMANENT: 'Internship to Permanent',
};
const CONFIRMATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  PENDING_ACCOUNTS_APPROVAL: 'Pending Accounts Approval',
  CONFIRMED: 'Confirmed',
  EXTENDED: 'Extended',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  SENT_BACK: 'Sent Back',
};
const INCREMENT_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual Increment',
  PERFORMANCE: 'Performance Increment',
  MERIT: 'Merit Increment',
  ADJUSTMENT: 'Adjustment Increment',
  SPECIAL: 'Special Increment',
};
const INCREMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  PENDING_ACCOUNTS_APPROVAL: 'Pending Accounts Approval',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  APPROVED: 'Approved',
  APPLIED: 'Applied',
  REJECTED: 'Rejected',
};
const PROMOTION_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular Promotion',
  ADJUSTMENT: 'Adjustment Promotion',
  UPGRADE: 'Upgrade Promotion',
  ACTING: 'Acting Promotion',
};
const PROMOTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  REJECTED_BY_MANAGER: 'Rejected by Manager',
  REJECTED_BY_HR: 'Rejected by HR',
};
const TRANSFER_TYPE_LABELS: Record<string, string> = {
  BRANCH: 'Branch Transfer',
  DEPARTMENT: 'Department Transfer',
  SHIFT: 'Shift Transfer',
  TEMPORARY: 'Temporary Transfer',
  PERMANENT: 'Permanent Transfer',
};
const TRANSFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

interface EmployeeDetailResponse {
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    designation: string | null;
    department: string | null;
    employmentType: string | null;
    status: string;
    joinedAt: string;
    basicSalary: string;
    houseAllowance: string;
    transportAllowance: string;
    medicalAllowance: string;
    otherAllowance: string;
    providentFund: string;
    taxDeduction: string;
    branch: { id: string; name: string };
    shift: { name: string; startTime: string; endTime: string } | null;
    reportingManager: { firstName: string; lastName: string } | null;
    systemRole: { name: string } | null;
  };
  attendance: { id: string; date: string; status: string; checkIn: string | null; checkOut: string | null }[];
  leaves: { id: string; type: string; status: string; fromDate: string; toDate: string; days: string; createdAt: string }[];
  payslips: {
    id: string;
    net: string;
    workedDays: string;
    createdAt: string;
    payrollRun: { period: string; status: string; branchName: string };
  }[];
  documents: { id: string; originalName: string; mimeType: string; size: number; category: string | null }[];
  audits: { id: string; action: string; module: string; createdAt: string }[];
  workflowRecords: {
    id: string;
    section: string;
    title: string;
    subject: string | null;
    status: string;
    priority: string;
    startDate: string | null;
    endDate: string | null;
    updatedAt: string;
  }[];
  transfers: {
    id: string;
    transferNumber: string;
    transferType: string;
    status: string;
    effectiveDate: string | null;
    startDate: string | null;
    endDate: string | null;
    newDepartment: string | null;
    tempDepartment: string | null;
    createdAt: string;
    newBranch: { name: string } | null;
    tempBranch: { name: string } | null;
    newShift: { name: string } | null;
    tempShift: { name: string } | null;
  }[];
  promotions: {
    id: string;
    promotionNumber: string;
    promotionType: string;
    status: string;
    newDesignation: string;
    newSalary: string;
    effectiveDate: string;
  }[];
  confirmations: {
    id: string;
    confirmationNumber: string;
    confirmationType: string;
    status: string;
    effectiveDate: string;
    salaryRevisionRequired: boolean;
    newBasicSalary: string;
  }[];
  increments: {
    id: string;
    incrementNumber: string;
    incrementType: string;
    status: string;
    newBasicSalary: string;
    effectiveDate: string;
  }[];
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive',
  RESIGNED: 'outline',
};

function formatTime(value: string) {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour) || !minute) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${String(normalizedHour).padStart(2, '0')}:${minute} ${suffix}`;
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.permissions.includes('hr:read')) {
    const canOpenConfirmations =
      session?.permissions.includes('accounts:read') ||
      session?.permissions.includes('accounts:post') ||
      (session?.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role));
    redirect(canOpenConfirmations ? '/hr/confirmations' : '/dashboard');
  }

  let data: EmployeeDetailResponse;
  try {
    data = await backendFetch<EmployeeDetailResponse>(`/api/mobile/hr/employees/${id}/detail`);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) notFound();
    throw error;
  }

  const { employee, attendance, leaves, payslips, documents, audits, workflowRecords, transfers, promotions, confirmations, increments } =
    data;

  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const presentCount = attendance.filter((record) => ['PRESENT', 'LATE', 'HALF_DAY'].includes(record.status)).length;
  const lateCount = attendance.filter((record) => record.status === 'LATE').length;
  const approvedLeaves = leaves.filter((leave) => leave.status === 'APPROVED').reduce((sum, leave) => sum + Number(leave.days), 0);
  const pendingLeaves = leaves.filter((leave) => ['PENDING_MANAGER', 'PENDING_HR'].includes(leave.status)).length;
  const payrollTotal = payslips.reduce((sum, payslip) => sum + Number(payslip.net), 0);

  const timeline = [
    { date: employee.joinedAt, title: 'Joined company', detail: `${employee.firstName} ${employee.lastName} joined ${employee.branch.name}` },
    ...leaves.slice(0, 4).map((leave) => ({
      date: leave.createdAt,
      title: `Leave ${leave.status.toLowerCase()}`,
      detail: `${leave.type} · ${leave.days} day(s)`,
    })),
    ...attendance.slice(0, 4).map((record) => ({
      date: record.date,
      title: 'Attendance recorded',
      detail: `${record.status}${record.checkIn ? ` · In ${record.checkIn.slice(11, 16)}` : ''}${record.checkOut ? ` · Out ${record.checkOut.slice(11, 16)}` : ''}`,
    })),
    ...payslips.slice(0, 4).map((payslip) => ({
      date: payslip.createdAt,
      title: 'Payroll generated',
      detail: `${payslip.payrollRun.period} · Net ${formatCurrency(payslip.net)}`,
    })),
    ...workflowRecords.slice(0, 8).map((record) => ({
      date: record.updatedAt,
      title: record.title,
      detail: `${record.section.replaceAll('-', ' ')} · ${record.status}`,
    })),
    ...audits.map((audit) => ({ date: audit.createdAt, title: `${audit.action.replaceAll('-', ' ')}`, detail: `${audit.module} update` })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
          <InfoRow label="Joined At" value={employee.joinedAt.slice(0, 10)} />
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
          <InfoRow
            label="Shift"
            value={employee.shift ? `${employee.shift.name} (${formatTime(employee.shift.startTime)}–${formatTime(employee.shift.endTime)})` : '—'}
          />
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
                    <p className="truncate text-sm font-medium">{link.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.mimeType} · {(link.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Badge variant="outline">{link.category ?? 'General'}</Badge>
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
                  <span className="font-mono text-xs text-muted-foreground">{record.date.slice(0, 10)}</span>
                  <div className="text-muted-foreground">
                    {record.checkIn ? `In ${record.checkIn.slice(11, 16)}` : 'No check-in'}
                    {' · '}
                    {record.checkOut ? `Out ${record.checkOut.slice(11, 16)}` : 'No check-out'}
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
                        {leave.fromDate.slice(0, 10)} to {leave.toDate.slice(0, 10)} · {leave.days} day(s)
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
          {payslips.length === 0 ? (
            <EmptyState text="No payroll history generated yet." />
          ) : (
            <ul className="space-y-3">
              {payslips.map((payslip) => (
                <li key={payslip.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{payslip.payrollRun.period}</p>
                    <p className="text-xs text-muted-foreground">
                      {payslip.payrollRun.branchName} · Worked {payslip.workedDays} day(s)
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
          <PromotionHistoryList records={promotions} />
        </SectionCard>
        <SectionCard title="Confirmation History">
          <ConfirmationHistoryList records={confirmations} />
        </SectionCard>
        <SectionCard title="Transfer History">
          <TransferHistoryList records={transfers} />
        </SectionCard>
        <SectionCard title="Increment History">
          <IncrementHistoryList records={increments} />
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
                <li key={`${item.title}-${item.date}-${index}`} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.date.slice(0, 10)}</p>
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

function InfoRow({ label, value, mono, numeric }: { label: string; value: string; mono?: boolean; numeric?: boolean }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-x-4 gap-y-1 py-2 text-sm">
      <span className="leading-6 text-muted-foreground">{label}</span>
      <span
        className={['min-w-0 break-words leading-6 text-foreground', mono ? 'font-mono text-xs leading-6' : '', numeric ? 'text-right tabular-nums font-medium' : '']
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
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
    startDate: string | null;
    endDate: string | null;
    updatedAt: string;
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
            <Badge variant={record.status === 'COMPLETED' || record.status === 'APPROVED' ? 'success' : 'outline'}>{record.status}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {(record.startDate ?? record.updatedAt).slice(0, 10)}
            {record.endDate ? ` to ${record.endDate.slice(0, 10)}` : ''}
            {' · '}
            {record.priority}
          </p>
        </li>
      ))}
    </ul>
  );
}

function getTransferDestination(record: EmployeeDetailResponse['transfers'][number]) {
  switch (record.transferType) {
    case 'BRANCH':
      return record.newBranch?.name ?? '—';
    case 'DEPARTMENT':
      return record.newDepartment ?? '—';
    case 'SHIFT':
      return record.newShift?.name ?? '—';
    case 'TEMPORARY': {
      const parts = [record.tempBranch?.name, record.tempDepartment, record.tempShift?.name].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'PERMANENT': {
      const parts = [record.newBranch?.name, record.newDepartment, record.newShift?.name].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    default:
      return '—';
  }
}

function getTransferDateLabel(record: EmployeeDetailResponse['transfers'][number]) {
  if (record.transferType === 'TEMPORARY') {
    const start = (record.startDate ?? record.createdAt).slice(0, 10);
    const end = record.endDate?.slice(0, 10) ?? '—';
    return `${start} to ${end}`;
  }
  return (record.effectiveDate ?? record.createdAt).slice(0, 10);
}

function TransferHistoryList({ records }: { records: EmployeeDetailResponse['transfers'] }) {
  if (records.length === 0) return <EmptyState text="No transfer history saved for this employee yet." />;

  return (
    <ul className="space-y-3">
      {records.map((record) => (
        <li key={record.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{TRANSFER_TYPE_LABELS[record.transferType] ?? record.transferType}</p>
              <p className="text-xs text-muted-foreground">
                {record.transferNumber} · {getTransferDestination(record)}
              </p>
            </div>
            <Badge
              variant={
                record.status === 'COMPLETED' || record.status === 'APPROVED'
                  ? 'success'
                  : record.status === 'REJECTED' || record.status === 'CANCELLED'
                    ? 'destructive'
                    : record.status === 'PENDING_APPROVAL' || record.status === 'SUBMITTED'
                      ? 'warning'
                      : 'outline'
              }
            >
              {TRANSFER_STATUS_LABELS[record.status] ?? record.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{getTransferDateLabel(record)}</p>
        </li>
      ))}
    </ul>
  );
}

function PromotionHistoryList({ records }: { records: EmployeeDetailResponse['promotions'] }) {
  if (records.length === 0) return <EmptyState text="No promotion history saved for this employee yet." />;

  return (
    <ul className="space-y-3">
      {records.map((record) => (
        <li key={record.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{PROMOTION_TYPE_LABELS[record.promotionType] ?? record.promotionType}</p>
              <p className="text-xs text-muted-foreground">
                {record.promotionNumber} · {record.newDesignation} · {formatCurrency(record.newSalary)}
              </p>
            </div>
            <Badge
              variant={
                record.status === 'COMPLETED' || record.status === 'APPROVED'
                  ? 'success'
                  : record.status === 'REJECTED_BY_MANAGER' || record.status === 'REJECTED_BY_HR'
                    ? 'destructive'
                    : record.status === 'PENDING_MANAGER_APPROVAL' || record.status === 'PENDING_HR_APPROVAL'
                      ? 'warning'
                      : 'outline'
              }
            >
              {PROMOTION_STATUS_LABELS[record.status] ?? record.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{record.effectiveDate.slice(0, 10)}</p>
        </li>
      ))}
    </ul>
  );
}

function ConfirmationHistoryList({ records }: { records: EmployeeDetailResponse['confirmations'] }) {
  if (records.length === 0) return <EmptyState text="No confirmation history saved for this employee yet." />;

  return (
    <ul className="space-y-3">
      {records.map((record) => (
        <li key={record.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{CONFIRMATION_TYPE_LABELS[record.confirmationType] ?? record.confirmationType}</p>
              <p className="text-xs text-muted-foreground">
                {record.confirmationNumber}
                {' · '}
                {record.salaryRevisionRequired ? formatCurrency(record.newBasicSalary) : 'No salary change'}
              </p>
            </div>
            <Badge variant={record.status === 'CONFIRMED' ? 'success' : record.status === 'REJECTED' ? 'destructive' : 'outline'}>
              {CONFIRMATION_STATUS_LABELS[record.status] ?? record.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Effective {record.effectiveDate.slice(0, 10)}</p>
        </li>
      ))}
    </ul>
  );
}

function IncrementHistoryList({ records }: { records: EmployeeDetailResponse['increments'] }) {
  if (records.length === 0) return <EmptyState text="No increment history saved for this employee yet." />;

  return (
    <ul className="space-y-3">
      {records.map((record) => (
        <li key={record.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{INCREMENT_TYPE_LABELS[record.incrementType] ?? record.incrementType}</p>
              <p className="text-xs text-muted-foreground">
                {record.incrementNumber} · {formatCurrency(record.newBasicSalary)}
              </p>
            </div>
            <Badge
              variant={
                record.status === 'APPLIED' || record.status === 'APPROVED'
                  ? 'success'
                  : record.status === 'REJECTED'
                    ? 'destructive'
                    : record.status.includes('PENDING')
                      ? 'warning'
                      : 'outline'
              }
            >
              {INCREMENT_STATUS_LABELS[record.status] ?? record.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{record.effectiveDate.slice(0, 10)}</p>
        </li>
      ))}
    </ul>
  );
}
