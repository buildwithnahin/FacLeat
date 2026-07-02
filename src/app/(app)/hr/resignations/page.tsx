import { BadgeCheck, Pencil, PlusCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import {
  isEmployeeResignationTableMissingError,
  isResignationTableAvailable,
  resignationsService,
  RESIGNATION_TABLE_UNAVAILABLE_MESSAGE,
} from '@/server/services/resignations.service';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResignationForm,
  ResignationKpiCards,
  ResignationTable,
} from './resignation-components';

export const metadata = { title: 'Employee Resignation - HR' };

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
  searchParams: Promise<{ edit?: string; status?: string; q?: string; error?: string }>;
}) {
  const { edit, status, q, error } = await searchParams;
  const session = await getSession();
  const activeBranch = session?.activeBranchId ?? undefined;

  if (!canAccessResignations(session)) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }

  const resignationsAvailable = await isResignationTableAvailable();

  const [employees, confirmationDates, listResult, countResult, editResult] = await Promise.all([
    prisma.employee.findMany({
      where: {
        branchId: activeBranch,
        status: { not: 'RESIGNED' },
      },
      include: {
        branch: true,
        reportingManager: true,
      },
      orderBy: [{ code: 'asc' }],
    }),
    resignationsAvailable
      ? prisma.employeeConfirmation
          .findMany({
            where: {
              employee: {
                branchId: activeBranch,
              },
              status: 'CONFIRMED',
            },
            orderBy: [{ confirmedAt: 'desc' }],
            select: {
              employeeId: true,
              confirmedAt: true,
            },
          })
          .then((rows) => {
            const map = new Map<string, string>();
            for (const row of rows) {
              if (!row.confirmedAt || map.has(row.employeeId)) continue;
              map.set(row.employeeId, row.confirmedAt.toISOString().slice(0, 10));
            }
            return map;
          })
          .catch(() => new Map<string, string>())
      : Promise.resolve(new Map<string, string>()),
    resignationsAvailable
      ? resignationsService
          .list(session, {
            branchId: activeBranch,
            status,
            q,
          })
          .then((records) => ({ records, unavailable: false }))
          .catch((tableError) => {
            if (isEmployeeResignationTableMissingError(tableError)) {
              return { records: [], unavailable: true };
            }
            throw tableError;
          })
      : Promise.resolve({ records: [], unavailable: true }),
    resignationsAvailable
      ? resignationsService
          .countByStatus(session, activeBranch)
          .then((counts) => ({ counts, unavailable: false }))
          .catch((tableError) => {
            if (isEmployeeResignationTableMissingError(tableError)) {
              return { counts: {}, unavailable: true };
            }
            throw tableError;
          })
      : Promise.resolve({ counts: {}, unavailable: true }),
    resignationsAvailable && edit
      ? resignationsService
          .getById(session, edit)
          .then((record) => ({ record, unavailable: false }))
          .catch((tableError) => {
            if (isEmployeeResignationTableMissingError(tableError)) {
              return { record: null, unavailable: true };
            }
            return { record: null, unavailable: false };
          })
      : Promise.resolve({ record: null, unavailable: false }),
  ]);

  const resignationsUnavailable = listResult.unavailable || countResult.unavailable || editResult.unavailable;
  const canHrWrite =
    session?.permissions.includes('hr:write') ||
    (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canManagerApprove = (session?.roles ?? []).some((role) => ['Management', 'Admin', 'Super Admin'].includes(role));
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
  }));

  const employeeDetails = Object.fromEntries(
    employees.map((employee) => [
      employee.id,
      {
        employeeLabel: `${employee.code} - ${employee.firstName} ${employee.lastName}`,
        employeeId: employee.code,
        branch: employee.branch?.name ?? '-',
        department: employee.department ?? '-',
        designation: employee.designation ?? '-',
        reportingManager: employee.reportingManager
          ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
          : '-',
        employmentType: employee.employmentType ?? '-',
        joiningDate: employee.joinedAt.toISOString().slice(0, 10),
        confirmationDate: confirmationDates.get(employee.id) ?? '-',
        currentStatus: employee.status,
      },
    ]),
  );

  const records = listResult.records.map((record) => ({
    id: record.id,
    resignationNumber: record.resignationNumber,
    resignationType: record.resignationType,
    resignationDate: record.resignationDate.toISOString(),
    lastWorkingDate: record.lastWorkingDate.toISOString(),
    noticeRequired: record.noticeRequired,
    noticePeriodDays: record.noticePeriodDays,
    noticeServedDays: record.noticeServedDays,
    noticeWaived: record.noticeWaived,
    buyoutAmount: record.buyoutAmount?.toString() ?? '',
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
    pendingSalary: record.pendingSalary.toString(),
    leaveEncashment: record.leaveEncashment.toString(),
    bonus: record.bonus.toString(),
    overtime: record.overtime.toString(),
    loanDeduction: record.loanDeduction.toString(),
    advanceDeduction: record.advanceDeduction.toString(),
    taxDeduction: record.taxDeduction.toString(),
    gratuity: record.gratuity.toString(),
    finalPayable: record.finalPayable.toString(),
    settlementRequired: record.settlementRequired,
    status: record.status,
    managerReviewStatus: record.managerReviewStatus,
    hrReviewStatus: record.hrReviewStatus,
    accountsReviewStatus: record.accountsReviewStatus,
    exitClearanceId: record.exitClearance?.id ?? null,
    employee: record.employee
      ? {
          id: record.employee.id,
          code: record.employee.code,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
        }
      : null,
  }));

  const editRecord = editResult.record
    ? records.find((record) => record.id === editResult.record?.id) ?? null
    : null;
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

      <ResignationKpiCards counts={countResult.counts} />

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
