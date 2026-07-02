import { BadgeCheck, Pencil, PlusCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import {
  confirmationsService,
  CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE,
  isConfirmationTableAvailable,
  isEmployeeConfirmationTableMissingError,
} from '@/server/services/confirmations.service';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  ConfirmationForm,
  ConfirmationKpiCards,
  ConfirmationTable,
} from './confirmation-components';

export const metadata = { title: 'Employee Confirmation — HR' };

function canAccessConfirmations(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  return (
    session.permissions.includes('hr:read') ||
    session.permissions.includes('accounts:read') ||
    session.permissions.includes('accounts:post') ||
    (session.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role))
  );
}

function computeGrossSalary(employee: {
  basicSalary: { toString(): string };
  houseAllowance: { toString(): string };
  transportAllowance: { toString(): string };
  medicalAllowance: { toString(): string };
  otherAllowance: { toString(): string };
  providentFund: { toString(): string };
  taxDeduction: { toString(): string };
}) {
  return (
    Number(employee.basicSalary.toString()) +
    Number(employee.houseAllowance.toString()) +
    Number(employee.transportAllowance.toString()) +
    Number(employee.medicalAllowance.toString()) +
    Number(employee.otherAllowance.toString()) -
    Number(employee.providentFund.toString()) -
    Number(employee.taxDeduction.toString())
  );
}

export default async function ConfirmationsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string; status?: string; q?: string; error?: string }>;
}) {
  const { edit, type, status, q, error } = await searchParams;
  const session = await getSession();
  const activeBranch = session?.activeBranchId ?? undefined;

  if (!canAccessConfirmations(session)) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }

  const confirmationsAvailable = await isConfirmationTableAvailable();

  const [employees, confirmationListResult, confirmationCountResult, editConfirmationResult] = await Promise.all([
    prisma.employee.findMany({
      where: {
        branchId: activeBranch,
        status: 'ACTIVE',
        employmentType: { in: ['PROBATION', 'INTERN'] },
      },
      include: {
        branch: true,
        reportingManager: {
          include: {
            user: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: [{ code: 'asc' }],
    }),
    confirmationsAvailable
      ? confirmationsService
          .list(session, {
            branchId: activeBranch,
            confirmationType: type,
            status,
            q,
          })
          .then((records) => ({ records, unavailable: false }))
          .catch((error) => {
            if (isEmployeeConfirmationTableMissingError(error)) {
              return { records: [], unavailable: true };
            }
            throw error;
          })
      : Promise.resolve({ records: [], unavailable: true }),
    confirmationsAvailable
      ? confirmationsService
          .countByStatus(session, activeBranch)
          .then((counts) => ({ counts, unavailable: false }))
          .catch((error) => {
            if (isEmployeeConfirmationTableMissingError(error)) {
              return { counts: {}, unavailable: true };
            }
            throw error;
          })
      : Promise.resolve({ counts: {}, unavailable: true }),
    confirmationsAvailable && edit
      ? confirmationsService
          .getById(session, edit)
          .then((record) => ({ record, unavailable: false }))
          .catch((error) => {
            if (isEmployeeConfirmationTableMissingError(error)) {
              return { record: null, unavailable: true };
            }
            return { record: null, unavailable: false };
          })
      : Promise.resolve({ record: null, unavailable: false }),
  ]);

  const confirmationsUnavailable =
    confirmationListResult.unavailable || confirmationCountResult.unavailable || editConfirmationResult.unavailable;

  const canWrite =
    session?.permissions.includes('hr:write') ||
    (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canHrApprove = canWrite;
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));
  const canManagerApprove = (session?.roles ?? []).some((role) => ['Management', 'Admin', 'Super Admin'].includes(role));

  const confirmations = confirmationListResult.records.map((confirmation) => ({
    id: confirmation.id,
    confirmationNumber: confirmation.confirmationNumber,
    confirmationType: confirmation.confirmationType,
    probationEndDate: confirmation.probationEndDate?.toISOString() ?? null,
    effectiveDate: confirmation.effectiveDate.toISOString(),
    salaryRevisionRequired: confirmation.salaryRevisionRequired,
    incrementAmount: confirmation.incrementAmount?.toString() ?? '0',
    currentBasicSalary: confirmation.currentBasicSalary.toString(),
    newBasicSalary: confirmation.newBasicSalary.toString(),
    currentGrossSalary: confirmation.currentGrossSalary.toString(),
    newGrossSalary: confirmation.newGrossSalary.toString(),
    benefitsRevision: confirmation.benefitsRevision,
    status: confirmation.status,
    employee: confirmation.employee
      ? {
          id: confirmation.employee.id,
          code: confirmation.employee.code,
          firstName: confirmation.employee.firstName,
          lastName: confirmation.employee.lastName,
        }
      : null,
  }));

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
  }));

  const employeeDetails: Record<
    string,
    {
      employeeLabel: string;
      branch: string;
      department: string;
      designation: string;
      employmentType: string;
      joiningDate: string;
      probationEndDate: string;
      basicSalary: string;
      grossSalary: string;
      reportingManager: string;
    }
  > = {};
  for (const employee of employees) {
    employeeDetails[employee.id] = {
      employeeLabel: `${employee.code} - ${employee.firstName} ${employee.lastName}`,
      branch: employee.branch?.name ?? '-',
      department: employee.department ?? '-',
      designation: employee.designation ?? '-',
      employmentType: employee.employmentType ?? '-',
      joiningDate: employee.joinedAt.toISOString().slice(0, 10),
      probationEndDate: '',
      basicSalary: employee.basicSalary.toString(),
      grossSalary: String(computeGrossSalary(employee)),
      reportingManager: employee.reportingManager
        ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
        : '-',
    };
  }

  const editConfirmation = editConfirmationResult.record;
  const isEditing = Boolean(editConfirmation && ['DRAFT', 'SENT_BACK'].includes(editConfirmation.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Confirmation"
        description="Manage probation and internship confirmation requests with conditional accounts approval."
      />

      {confirmationsUnavailable && (
        <AlertBanner tone="warning" title="Confirmation migration required">
          {CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE}
        </AlertBanner>
      )}

      {error && (
        <AlertBanner tone="warning" title="Confirmation action blocked">
          {error}
        </AlertBanner>
      )}

      <ConfirmationKpiCards counts={confirmationCountResult.counts} />

      {canWrite && !confirmationsUnavailable && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              {isEditing ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <PlusCircle className="h-4 w-4 text-primary" />
              )}
              {isEditing ? 'Edit Confirmation Request' : 'New Confirmation Request'}
            </div>
            <ConfirmationForm
              mode={isEditing ? 'edit' : 'create'}
              employees={employeeOptions}
              employeeDetails={employeeDetails}
              initial={
                isEditing && editConfirmation
                  ? {
                      id: editConfirmation.id,
                      employeeId: editConfirmation.employeeId,
                      confirmationType: editConfirmation.confirmationType,
                      probationEndDate: editConfirmation.probationEndDate?.toISOString() ?? null,
                      effectiveDate: editConfirmation.effectiveDate.toISOString(),
                      salaryRevisionRequired: editConfirmation.salaryRevisionRequired,
                      incrementAmount: editConfirmation.incrementAmount?.toString() ?? '',
                      benefitsRevision: editConfirmation.benefitsRevision,
                      reason: editConfirmation.reason,
                      performanceSummary: editConfirmation.performanceSummary,
                      remarks: editConfirmation.remarks,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-primary" />
              Confirmation Records
            </div>
          </div>
          <ConfirmationTable
            confirmations={confirmations}
            canSubmit={canWrite}
            canHrApprove={Boolean(canHrApprove)}
            canAccountsApprove={Boolean(canAccountsApprove)}
            canManagerApprove={Boolean(canManagerApprove)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
