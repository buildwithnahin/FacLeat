import { BadgeCheck, Pencil, PlusCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  ConfirmationForm,
  ConfirmationKpiCards,
  ConfirmationTable,
} from './confirmation-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Confirmation — HR' };

const CONFIRMATION_TABLE_UNAVAILABLE_MESSAGE =
  'Confirmation tables are not migrated on this database yet. Run the pending Prisma migration to enable this module.';

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  branchName: string | null;
  department: string | null;
  designation: string | null;
  basicSalary: string;
  houseAllowance: string;
  transportAllowance: string;
  medicalAllowance: string;
  otherAllowance: string;
  providentFund: string;
  taxDeduction: string;
}

interface ConfirmationRow {
  id: string;
  confirmationNumber: string;
  confirmationType: string;
  probationEndDate: string | null;
  effectiveDate: string;
  salaryRevisionRequired: boolean;
  incrementAmount: string | null;
  currentBasicSalary: string;
  newBasicSalary: string;
  currentGrossSalary: string;
  newGrossSalary: string;
  benefitsRevision: string | null;
  status: string;
  reason: string;
  performanceSummary: string | null;
  remarks: string | null;
  employeeId: string;
  employee: { id: string; code: string; firstName: string; lastName: string } | null;
}

function canAccessConfirmations(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  return (
    session.permissions.includes('hr:read') ||
    session.permissions.includes('accounts:read') ||
    session.permissions.includes('accounts:post') ||
    (session.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role))
  );
}

function computeGrossSalary(employee: EmployeeRow) {
  return (
    Number(employee.basicSalary) +
    Number(employee.houseAllowance) +
    Number(employee.transportAllowance) +
    Number(employee.medicalAllowance) +
    Number(employee.otherAllowance) -
    Number(employee.providentFund) -
    Number(employee.taxDeduction)
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

  const listParams = new URLSearchParams();
  if (activeBranch) listParams.set('branchId', activeBranch);
  if (type) listParams.set('confirmationType', type);
  if (status) listParams.set('status', status);
  if (q) listParams.set('q', q);

  const [employees, confirmationListResult, counts] = await Promise.all([
    backendFetch<EmployeeRow[]>(
      `/api/mobile/hr/employees?status=ACTIVE${activeBranch ? `&branchId=${activeBranch}` : ''}`,
    ),
    backendFetch<{ records: ConfirmationRow[]; unavailable: boolean }>(`/api/mobile/hr/confirmations?${listParams.toString()}`),
    backendFetch<Record<string, number>>(`/api/mobile/hr/confirmations/counts${activeBranch ? `?branchId=${activeBranch}` : ''}`),
  ]);

  const confirmationsUnavailable = confirmationListResult.unavailable;
  const confirmations = confirmationListResult.records;

  const canWrite =
    session?.permissions.includes('hr:write') ||
    (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canHrApprove = canWrite;
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));
  const canManagerApprove = (session?.roles ?? []).some((role) => ['Management', 'Admin', 'Super Admin'].includes(role));

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
      branch: employee.branchName ?? '-',
      department: employee.department ?? '-',
      designation: employee.designation ?? '-',
      employmentType: '-',
      joiningDate: '',
      probationEndDate: '',
      basicSalary: employee.basicSalary,
      grossSalary: String(computeGrossSalary(employee)),
      reportingManager: '-',
    };
  }

  const editConfirmation = edit ? confirmations.find((c) => c.id === edit) ?? null : null;
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

      <ConfirmationKpiCards counts={counts} />

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
                      probationEndDate: editConfirmation.probationEndDate,
                      effectiveDate: editConfirmation.effectiveDate,
                      salaryRevisionRequired: editConfirmation.salaryRevisionRequired,
                      incrementAmount: editConfirmation.incrementAmount ?? '',
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
            confirmations={confirmations.map((c) => ({ ...c, incrementAmount: c.incrementAmount ?? '0' }))}
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
