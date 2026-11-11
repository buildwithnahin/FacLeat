import { BadgeCheck, ClipboardCheck } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ExitClearanceForm, ExitClearanceTable } from './exit-clearance-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Exit Clearance - HR' };

const RESIGNATION_TABLE_UNAVAILABLE_MESSAGE =
  'Resignation tables are not migrated on this database yet. Run the pending Prisma migration to enable this module.';

interface ExitClearanceRow {
  id: string;
  clearanceNumber: string;
  resignationId: string;
  lastWorkingDate: string;
  exitType: string;
  status: string;
  reasonForExit: string | null;
  noticePeriodServed: boolean;
  handoverCompleted: boolean;
  replacementAssigned: boolean;
  exitInterviewCompleted: boolean;
  hrRemarks: string | null;
  branch: { name: string };
  resignation: { resignationNumber: string; resignationDate: string };
  employee: {
    firstName: string;
    lastName: string;
    code: string;
    department: string | null;
    designation: string | null;
    joinedAt: string;
    reportingManager: { firstName: string; lastName: string } | null;
  };
  departments: Array<{ departmentKey: string; departmentName: string; responsiblePerson: string | null; status: string; remarks: string | null }>;
  assets: Array<{ assetKey: string; assetName: string; returned: boolean; condition: string; deductionAmount: string; remarks: string | null }>;
  systemAccess: {
    erpAccountDisabled: boolean;
    emailDisabled: boolean;
    attendanceDeviceDisabled: boolean;
    vpnDisabled: boolean;
    fingerprintRemoved: boolean;
    doorAccessRemoved: boolean;
  } | null;
  settlement: {
    pendingSalary: string;
    leaveEncashment: string;
    bonus: string;
    overtime: string;
    loanRecovery: string;
    advanceRecovery: string;
    assetDamageRecovery: string;
    noticePay: string;
    gratuity: string;
    taxDeduction: string;
    otherDeduction: string;
    netPayable: string;
    remarks: string | null;
    status: string;
  } | null;
  interview: {
    reasonForLeaving: string | null;
    companyRating: number | null;
    managerRating: number | null;
    suggestions: string | null;
    rehireEligible: boolean | null;
    interviewConductedBy: string | null;
  } | null;
}

function canAccessExitClearance(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  return (
    session.permissions.includes('hr:read') ||
    session.permissions.includes('accounts:read') ||
    session.permissions.includes('accounts:post') ||
    (session.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role))
  );
}

export default async function ExitClearancePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string; error?: string; q?: string }>;
}) {
  const { id, status, error, q } = await searchParams;
  const session = await getSession();
  const activeBranch = session?.activeBranchId ?? undefined;

  if (!canAccessExitClearance(session)) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }

  const canHrWrite =
    session?.permissions.includes('hr:write') || (session?.roles ?? []).some((role) => ['HR', 'Admin', 'Super Admin'].includes(role));
  const canAccountsApprove =
    session?.permissions.includes('accounts:post') || (session?.roles ?? []).some((role) => ['Accounts', 'Admin', 'Super Admin'].includes(role));
  const canDepartmentApprove = (session?.roles ?? []).some((role) => ['Management', 'HR', 'Admin', 'Super Admin'].includes(role));

  const listParams = new URLSearchParams();
  if (activeBranch) listParams.set('branchId', activeBranch);
  if (status) listParams.set('status', status);
  if (q) listParams.set('q', q);

  const listResult = await backendFetch<{ records: ExitClearanceRow[]; unavailable: boolean }>(
    `/api/mobile/hr/exit-clearance?${listParams.toString()}`,
  );

  const clearancesUnavailable = listResult.unavailable;
  const selectedRecord = id ? listResult.records.find((record) => record.id === id) ?? null : listResult.records[0] ?? null;

  const records = listResult.records.map((record) => ({
    id: record.id,
    clearanceNumber: record.clearanceNumber,
    resignationId: record.resignationId,
    resignationNumber: record.resignation.resignationNumber,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    employeeCode: record.employee.code,
    branchName: record.branch.name,
    department: record.employee.department ?? '-',
    designation: record.employee.designation ?? '-',
    reportingManager: record.employee.reportingManager
      ? `${record.employee.reportingManager.firstName} ${record.employee.reportingManager.lastName}`
      : '-',
    joiningDate: new Date(record.employee.joinedAt).toISOString().slice(0, 10),
    resignationDate: new Date(record.resignation.resignationDate).toISOString().slice(0, 10),
    lastWorkingDate: new Date(record.lastWorkingDate).toISOString().slice(0, 10),
    exitType: record.exitType,
    status: record.status,
    reasonForExit: record.reasonForExit ?? '',
    noticePeriodServed: record.noticePeriodServed,
    handoverCompleted: record.handoverCompleted,
    replacementAssigned: record.replacementAssigned,
    exitInterviewCompleted: record.exitInterviewCompleted,
    hrRemarks: record.hrRemarks ?? '',
    departments: record.departments.map((item) => ({
      departmentKey: item.departmentKey,
      departmentName: item.departmentName,
      responsiblePerson: item.responsiblePerson ?? '',
      status: item.status,
      remarks: item.remarks ?? '',
    })),
    assets: record.assets.map((item) => ({
      assetKey: item.assetKey,
      assetName: item.assetName,
      returned: item.returned,
      condition: item.condition,
      deductionAmount: item.deductionAmount,
      remarks: item.remarks ?? '',
    })),
    systemAccess: {
      erpAccountDisabled: record.systemAccess?.erpAccountDisabled ?? false,
      emailDisabled: record.systemAccess?.emailDisabled ?? false,
      attendanceDeviceDisabled: record.systemAccess?.attendanceDeviceDisabled ?? false,
      vpnDisabled: record.systemAccess?.vpnDisabled ?? false,
      fingerprintRemoved: record.systemAccess?.fingerprintRemoved ?? false,
      doorAccessRemoved: record.systemAccess?.doorAccessRemoved ?? false,
    },
    settlement: {
      pendingSalary: record.settlement?.pendingSalary ?? '0',
      leaveEncashment: record.settlement?.leaveEncashment ?? '0',
      bonus: record.settlement?.bonus ?? '0',
      overtime: record.settlement?.overtime ?? '0',
      loanRecovery: record.settlement?.loanRecovery ?? '0',
      advanceRecovery: record.settlement?.advanceRecovery ?? '0',
      assetDamageRecovery: record.settlement?.assetDamageRecovery ?? '0',
      noticePay: record.settlement?.noticePay ?? '0',
      gratuity: record.settlement?.gratuity ?? '0',
      taxDeduction: record.settlement?.taxDeduction ?? '0',
      otherDeduction: record.settlement?.otherDeduction ?? '0',
      netPayable: record.settlement?.netPayable ?? '0',
      remarks: record.settlement?.remarks ?? '',
      status: record.settlement?.status ?? 'PENDING',
    },
    interview: {
      reasonForLeaving: record.interview?.reasonForLeaving ?? '',
      companyRating: record.interview?.companyRating ? String(record.interview.companyRating) : '',
      managerRating: record.interview?.managerRating ? String(record.interview.managerRating) : '',
      suggestions: record.interview?.suggestions ?? '',
      rehireEligible:
        record.interview?.rehireEligible == null ? '' : record.interview.rehireEligible ? 'yes' : 'no',
      interviewConductedBy: record.interview?.interviewConductedBy ?? '',
    },
  }));

  const selected = selectedRecord ? records.find((record) => record.id === selectedRecord.id) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exit Clearance"
        description="Separate the resignation approval from the final separation process, with department clearance, accounts settlement, and HR completion."
      />

      {clearancesUnavailable && (
        <AlertBanner tone="warning" title="Migration required">
          {RESIGNATION_TABLE_UNAVAILABLE_MESSAGE}
        </AlertBanner>
      )}

      {error && (
        <AlertBanner tone="warning" title="Exit clearance action blocked">
          {error}
        </AlertBanner>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-primary" />
              Exit Clearance Queue
            </div>
          </div>
          <ExitClearanceTable records={records} />
        </CardContent>
      </Card>

      {selected && !clearancesUnavailable && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Exit Clearance Details
            </div>
            <ExitClearanceForm
              record={selected}
              canHrWrite={Boolean(canHrWrite)}
              canAccountsApprove={Boolean(canAccountsApprove)}
              canDepartmentApprove={Boolean(canDepartmentApprove)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
