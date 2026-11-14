import { BadgeCheck, Pencil, PlusCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResignationForm,
  ResignationKpiCards,
  ResignationTable,
} from './resignation-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Resignation - HR' };

const RESIGNATION_TABLE_UNAVAILABLE_MESSAGE =
  'Resignation tables are not migrated on this database yet. Run the pending Prisma migration to enable this module.';

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  branchName: string | null;
  department: string | null;
  designation: string | null;
  status: string;
}

interface ResignationRow {
  id: string;
  resignationNumber: string;
  resignationType: string;
  resignationDate: string;
  lastWorkingDate: string;
  noticeRequired: boolean;
  noticePeriodDays: number;
  noticeServedDays: number | null;
  noticeWaived: boolean;
  buyoutAmount: string | null;
  reason: string;
  employeeRemarks: string | null;
  attachmentUrl: string | null;
  managerPerformance: string | null;
  currentProjects: string | null;
  handoverStatus: string | null;
  replacementNeeded: boolean;
  assetsReturned: boolean;
  managerRecommendation: string | null;
  attendanceVerified: boolean;
  leaveBalanceVerified: boolean;
  noticePeriodVerified: boolean;
  documentsVerified: boolean;
  policyVerified: boolean;
  pendingSalary: string;
  leaveEncashment: string;
  bonus: string;
  overtime: string;
  loanDeduction: string;
  advanceDeduction: string;
  taxDeduction: string;
  gratuity: string;
  finalPayable: string;
  settlementRequired: boolean;
  status: string;
  managerReviewStatus: string;
  hrReviewStatus: string;
  accountsReviewStatus: string;
  employeeId: string;
  exitClearance: { id: string } | null;
  employee: { id: string; code: string; firstName: string; lastName: string } | null;
}

function canAccessResignations(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  return (
    session.permissions.includes('hr:read') ||
    session.permissions.includes('accounts:read') ||
    session.permissions.includes('accounts:post') ||
    (session.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role))
  );
}

export default async function ResignationsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; status?: string; q?: string; branchId?: string; error?: string }>;
}) {
  const { edit, status, q, branchId, error } = await searchParams;
  const session = await getSession();
  const activeBranch = session?.activeBranchId ?? undefined;
  const branchFilter = branchId ? (branchId === 'ALL' ? undefined : branchId) : activeBranch;

  if (!canAccessResignations(session)) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }

  const listParams = new URLSearchParams();
  if (branchFilter) listParams.set('branchId', branchFilter);
  if (status) listParams.set('status', status);
  if (q) listParams.set('q', q);

  const [employees, confirmationDates, listResult, counts] = await Promise.all([
    backendFetch<EmployeeRow[]>(`/api/mobile/hr/employees${branchFilter ? `?branchId=${branchFilter}` : ''}`),
    backendFetch<Record<string, string>>(
      `/api/mobile/hr/confirmations/confirmation-dates${branchFilter ? `?branchId=${branchFilter}` : ''}`,
    ),
    backendFetch<{ records: ResignationRow[]; unavailable: boolean }>(`/api/mobile/hr/resignations?${listParams.toString()}`),
    backendFetch<Record<string, number>>(`/api/mobile/hr/resignations/counts${branchFilter ? `?branchId=${branchFilter}` : ''}`),
  ]);

  const activeEmployees = employees.filter((e) => e.status !== 'RESIGNED');
  const resignationsUnavailable = listResult.unavailable;
  const canHrWrite =
    session?.permissions.includes('hr:write') ||
    (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canManagerApprove = (session?.roles ?? []).some((role) => ['Management', 'Admin', 'Super Admin'].includes(role));
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));

  const employeeOptions = activeEmployees.map((employee) => ({
    id: employee.id,
    label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
  }));

  const employeeDetails = Object.fromEntries(
    activeEmployees.map((employee) => [
      employee.id,
      {
        employeeLabel: `${employee.code} - ${employee.firstName} ${employee.lastName}`,
        employeeId: employee.code,
        branch: employee.branchName ?? '-',
        department: employee.department ?? '-',
        designation: employee.designation ?? '-',
        reportingManager: '-',
        employmentType: '-',
        joiningDate: '',
        confirmationDate: confirmationDates[employee.id] ?? '-',
        currentStatus: employee.status,
      },
    ]),
  );

  const records = listResult.records.map((record) => ({
    id: record.id,
    resignationNumber: record.resignationNumber,
    resignationType: record.resignationType,
    resignationDate: record.resignationDate,
    lastWorkingDate: record.lastWorkingDate,
    noticeRequired: record.noticeRequired,
    noticePeriodDays: record.noticePeriodDays,
    noticeServedDays: record.noticeServedDays ?? 0,
    noticeWaived: record.noticeWaived,
    buyoutAmount: record.buyoutAmount ?? '',
    reason: record.reason,
    employeeRemarks: record.employeeRemarks,
    attachmentUrl: record.attachmentUrl,
    managerPerformance: record.managerPerformance,
    currentProjects: record.currentProjects,
    handoverStatus: record.handoverStatus,
    replacementNeeded: record.replacementNeeded,
    assetsReturned: record.assetsReturned,
    managerRecommendation: record.managerRecommendation,
    attendanceVerified: record.attendanceVerified,
    leaveBalanceVerified: record.leaveBalanceVerified,
    noticePeriodVerified: record.noticePeriodVerified,
    documentsVerified: record.documentsVerified,
    policyVerified: record.policyVerified,
    pendingSalary: record.pendingSalary,
    leaveEncashment: record.leaveEncashment,
    bonus: record.bonus,
    overtime: record.overtime,
    loanDeduction: record.loanDeduction,
    advanceDeduction: record.advanceDeduction,
    taxDeduction: record.taxDeduction,
    gratuity: record.gratuity,
    finalPayable: record.finalPayable,
    settlementRequired: record.settlementRequired,
    status: record.status,
    managerReviewStatus: record.managerReviewStatus,
    hrReviewStatus: record.hrReviewStatus,
    accountsReviewStatus: record.accountsReviewStatus,
    exitClearanceId: record.exitClearance?.id ?? null,
    employee: record.employee,
  }));

  const editRecord = edit ? records.find((record) => record.id === edit) ?? null : null;
  const isEditing = Boolean(editRecord && ['DRAFT', 'WITHDRAWN'].includes(editRecord.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Resignation"
        description="Manage resignation requests, staged approvals, settlement review, and exit readiness."
      />

      {resignationsUnavailable && (
        <AlertBanner tone="warning" title="Resignation migration required">
          {RESIGNATION_TABLE_UNAVAILABLE_MESSAGE}
        </AlertBanner>
      )}

      {error && (
        <AlertBanner tone="warning" title="Resignation action blocked">
          {error}
        </AlertBanner>
      )}

      <ResignationKpiCards counts={counts} />

      {canHrWrite && !resignationsUnavailable && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              {isEditing ? <Pencil className="h-4 w-4 text-primary" /> : <PlusCircle className="h-4 w-4 text-primary" />}
              {isEditing ? 'Edit Resignation Request' : 'New Resignation Request'}
            </div>
            <ResignationForm
              mode={isEditing ? 'edit' : 'create'}
              employees={employeeOptions}
              employeeDetails={employeeDetails}
              initial={editRecord ?? undefined}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-primary" />
              Resignation Records
            </div>
          </div>
          <ResignationTable
            records={records}
            canHrWrite={Boolean(canHrWrite)}
            canManagerApprove={Boolean(canManagerApprove)}
            canAccountsApprove={Boolean(canAccountsApprove)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
