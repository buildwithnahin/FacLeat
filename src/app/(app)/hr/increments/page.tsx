import { ArrowUpCircle, Pencil, PlusCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import {
  incrementsService,
  INCREMENT_TABLE_UNAVAILABLE_MESSAGE,
  isEmployeeIncrementTableMissingError,
  isIncrementTableAvailable,
} from '@/server/services/increments.service';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  IncrementForm,
  IncrementKpiCards,
  IncrementTable,
} from './increment-components';

export const metadata = { title: 'Employee Increment — HR' };

function canAccessIncrements(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  return (
    session.permissions.includes('hr:read') ||
    session.permissions.includes('accounts:read') ||
    session.permissions.includes('accounts:post') ||
    (session.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role))
  );
}

async function isReportingManagerUser(
  session: Awaited<ReturnType<typeof getSession>>,
  branchId?: string,
) {
  if (!session?.userId) return false;
  const managedEmployees = await prisma.employee.count({
    where: {
      branchId,
      status: 'ACTIVE',
      reportingManager: {
        user: {
          id: session.userId,
        },
      },
    },
  });
  return managedEmployees > 0;
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

export default async function IncrementsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string; status?: string; q?: string }>;
}) {
  const { edit, type, status, q } = await searchParams;
  const session = await getSession();
  const activeBranch = session?.activeBranchId ?? undefined;
  const hasManagerAccess = await isReportingManagerUser(session, activeBranch);

  if (!canAccessIncrements(session) && !hasManagerAccess) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }
  const incrementsAvailable = await isIncrementTableAvailable();

  const [employees, incrementListResult, incrementCountResult, editIncrementResult] = await Promise.all([
    prisma.employee.findMany({
      where: {
        branchId: activeBranch,
        status: 'ACTIVE',
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
    incrementsAvailable
      ? incrementsService
          .list(session, {
            branchId: activeBranch,
            incrementType: type,
            status,
            q,
          })
          .then((records) => ({ records, unavailable: false }))
          .catch((error) => {
            if (isEmployeeIncrementTableMissingError(error)) {
              return { records: [], unavailable: true };
            }
            throw error;
          })
      : Promise.resolve({ records: [], unavailable: true }),
    incrementsAvailable
      ? incrementsService
          .countByStatus(session, activeBranch)
          .then((counts) => ({ counts, unavailable: false }))
          .catch((error) => {
            if (isEmployeeIncrementTableMissingError(error)) {
              return { counts: {}, unavailable: true };
            }
            throw error;
          })
      : Promise.resolve({ counts: {}, unavailable: true }),
    incrementsAvailable && edit
      ? incrementsService
          .getById(session, edit)
          .then((record) => ({ record, unavailable: false }))
          .catch((error) => {
            if (isEmployeeIncrementTableMissingError(error)) {
              return { record: null, unavailable: true };
            }
            return { record: null, unavailable: false };
          })
      : Promise.resolve({ record: null, unavailable: false }),
  ]);

  const incrementUnavailable =
    incrementListResult.unavailable || incrementCountResult.unavailable || editIncrementResult.unavailable;
  const canCreateOrSubmit =
    session?.permissions.includes('hr:write') ||
    (session?.roles ?? []).some((role) => ['HR', 'Management', 'Admin', 'Super Admin'].includes(role)) ||
    hasManagerAccess;
  const canHrApprove =
    session?.permissions.includes('hr:write') || (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));
  const increments = incrementListResult.records.map((increment) => ({
    id: increment.id,
    incrementNumber: increment.incrementNumber,
    incrementType: increment.incrementType,
    incrementMethod: increment.incrementMethod,
    incrementValue: increment.incrementValue.toString(),
    currentBasicSalary: increment.currentBasicSalary.toString(),
    newBasicSalary: increment.newBasicSalary.toString(),
    currentGrossSalary: increment.currentGrossSalary.toString(),
    newGrossSalary: increment.newGrossSalary.toString(),
    effectiveDate: increment.effectiveDate.toISOString(),
    status: increment.status,
    reportingManagerUserId: increment.reportingManager?.user?.id ?? null,
    employee: increment.employee
      ? {
          id: increment.employee.id,
          code: increment.employee.code,
          firstName: increment.employee.firstName,
          lastName: increment.employee.lastName,
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
      basicSalary: string;
      grossSalary: string;
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
      basicSalary: employee.basicSalary.toString(),
      grossSalary: String(computeGrossSalary(employee)),
    };
  }

  const editIncrement = editIncrementResult.record;
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

      <IncrementKpiCards counts={incrementCountResult.counts} />

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
                      incrementValue: editIncrement.incrementValue.toString(),
                      effectiveDate: editIncrement.effectiveDate.toISOString(),
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
            increments={increments}
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
