import { ArrowUpCircle, Pencil, PlusCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  IncrementForm,
  IncrementKpiCards,
  IncrementTable,
} from './increment-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Increment — HR' };

const INCREMENT_TABLE_UNAVAILABLE_MESSAGE =
  'Increment tables are not migrated on this database yet. Run the pending Prisma migration to enable this module.';

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  branchName: string | null;
  basicSalary: string;
  houseAllowance: string;
  transportAllowance: string;
  medicalAllowance: string;
  otherAllowance: string;
  providentFund: string;
  taxDeduction: string;
}

interface IncrementRow {
  id: string;
  incrementNumber: string;
  incrementType: string;
  incrementMethod: string;
  incrementValue: string;
  currentBasicSalary: string;
  newBasicSalary: string;
  currentGrossSalary: string;
  newGrossSalary: string;
  effectiveDate: string;
  status: string;
  reason: string;
  performanceSummary: string | null;
  remarks: string | null;
  employeeId: string;
  reportingManager: { user: { id: string } | null } | null;
  employee: { id: string; code: string; firstName: string; lastName: string } | null;
}

function canAccessIncrements(session: Awaited<ReturnType<typeof getSession>>) {
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

export default async function IncrementsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string; status?: string; q?: string }>;
}) {
  const { edit, type, status, q } = await searchParams;
  const session = await getSession();
  const activeBranch = session?.activeBranchId ?? undefined;

  const managedCount = await backendFetch<{ count: number }>(
    `/api/mobile/hr/employees/managed-count${activeBranch ? `?branchId=${activeBranch}` : ''}`,
  );
  const hasManagerAccess = managedCount.count > 0;

  if (!canAccessIncrements(session) && !hasManagerAccess) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }

  const listParams = new URLSearchParams();
  if (activeBranch) listParams.set('branchId', activeBranch);
  if (type) listParams.set('incrementType', type);
  if (status) listParams.set('status', status);
  if (q) listParams.set('q', q);

  const [employees, incrementListResult, counts] = await Promise.all([
    backendFetch<EmployeeRow[]>(`/api/mobile/hr/employees?status=ACTIVE${activeBranch ? `&branchId=${activeBranch}` : ''}`),
    backendFetch<{ records: IncrementRow[]; unavailable: boolean }>(`/api/mobile/hr/increments?${listParams.toString()}`),
    backendFetch<Record<string, number>>(`/api/mobile/hr/increments/counts${activeBranch ? `?branchId=${activeBranch}` : ''}`),
  ]);

  const incrementUnavailable = incrementListResult.unavailable;
  const increments = incrementListResult.records;

  const canCreateOrSubmit =
    session?.permissions.includes('hr:write') ||
    (session?.roles ?? []).some((role) => ['HR', 'Management', 'Admin', 'Super Admin'].includes(role)) ||
    hasManagerAccess;
  const canHrApprove =
    session?.permissions.includes('hr:write') || (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));

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
      basicSalary: string;
      grossSalary: string;
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
      basicSalary: employee.basicSalary,
      grossSalary: String(computeGrossSalary(employee)),
    };
  }

  const editIncrement = edit ? increments.find((i) => i.id === edit) ?? null : null;
  const isEditing = Boolean(editIncrement && editIncrement.status === 'DRAFT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Increment"
        description="Manage salary increment recommendations, approvals, and effective-date application."
      />

      {incrementUnavailable && (
        <AlertBanner tone="warning" title="Increment migration required">
          {INCREMENT_TABLE_UNAVAILABLE_MESSAGE}
        </AlertBanner>
      )}

      <IncrementKpiCards counts={counts} />

      {canCreateOrSubmit && !incrementUnavailable && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              {isEditing ? <Pencil className="h-4 w-4 text-primary" /> : <PlusCircle className="h-4 w-4 text-primary" />}
              {isEditing ? 'Edit Increment' : 'New Increment Request'}
            </div>
            <IncrementForm
              mode={isEditing ? 'edit' : 'create'}
              employees={employeeOptions}
              employeeDetails={employeeDetails}
              initial={
                isEditing && editIncrement
                  ? {
                      id: editIncrement.id,
                      employeeId: editIncrement.employeeId,
                      incrementType: editIncrement.incrementType,
                      incrementMethod: editIncrement.incrementMethod,
                      incrementValue: editIncrement.incrementValue,
                      effectiveDate: editIncrement.effectiveDate,
                      reason: editIncrement.reason,
                      performanceSummary: editIncrement.performanceSummary,
                      remarks: editIncrement.remarks,
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
              <ArrowUpCircle className="h-4 w-4 text-primary" />
              Increment Records
            </div>
          </div>
          <IncrementTable
            increments={increments.map((increment) => ({
              id: increment.id,
              incrementNumber: increment.incrementNumber,
              incrementType: increment.incrementType,
              incrementMethod: increment.incrementMethod,
              incrementValue: increment.incrementValue,
              currentBasicSalary: increment.currentBasicSalary,
              newBasicSalary: increment.newBasicSalary,
              currentGrossSalary: increment.currentGrossSalary,
              newGrossSalary: increment.newGrossSalary,
              effectiveDate: increment.effectiveDate,
              status: increment.status,
              reportingManagerUserId: increment.reportingManager?.user?.id ?? null,
              employee: increment.employee,
            }))}
            canSubmit={Boolean(canCreateOrSubmit)}
            canHrApprove={Boolean(canHrApprove)}
            canAccountsApprove={Boolean(canAccountsApprove)}
            canApply={Boolean(canHrApprove)}
            currentUserId={session?.userId ?? ''}
          />
        </CardContent>
      </Card>
    </div>
  );
}
