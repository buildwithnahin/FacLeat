import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, ArrowRightLeft } from 'lucide-react';
import {
  TransferForm,
  TransferTable,
  TransferKpiCards,
} from './transfer-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employee Transfer — HR' };

interface BranchRow {
  id: string;
  code: string;
  name: string;
}

interface ShiftRow {
  id: string;
  code: string;
  name: string;
}

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  branchId: string;
  branchName: string | null;
  department: string | null;
  designation: string | null;
  shiftName: string | null;
}

interface MasterDataRow {
  id: string;
  name: string;
}

interface TransferRow {
  id: string;
  transferNumber: string;
  transferType: string;
  status: string;
  reason: string;
  remarks: string | null;
  branchId: string;
  employeeId: string;
  newReportingManagerId: string | null;
  newBranchId: string | null;
  newDepartment: string | null;
  newShiftId: string | null;
  tempBranchId: string | null;
  tempDepartment: string | null;
  tempShiftId: string | null;
  effectiveDate: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  employee: { code: string; firstName: string; lastName: string } | null;
  branch: { code: string; name: string } | null;
  newBranch: { code: string; name: string } | null;
  tempBranch: { code: string; name: string } | null;
  newShift: { name: string } | null;
  tempShift: { name: string } | null;
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string; status?: string; q?: string }>;
}) {
  const { edit, type, status, q } = await searchParams;
  const session = await getSession();

  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const activeBranch = session?.activeBranchId ?? undefined;

  const listParams = new URLSearchParams();
  if (activeBranch) listParams.set('branchId', activeBranch);
  if (type) listParams.set('transferType', type);
  if (status) listParams.set('status', status);
  if (q) listParams.set('q', q);

  const [branches, employees, shifts, departmentRows, transfers, counts, editTransfer] = await Promise.all([
    backendFetch<BranchRow[]>('/api/mobile/branches?activeOnly=true'),
    backendFetch<EmployeeRow[]>('/api/mobile/hr/employees?status=ACTIVE'),
    backendFetch<ShiftRow[]>('/api/mobile/hr/shifts'),
    backendFetch<MasterDataRow[]>('/api/mobile/hr/master-data?type=departments'),
    backendFetch<TransferRow[]>(`/api/mobile/hr/transfers?${listParams.toString()}`),
    backendFetch<Record<string, number>>(`/api/mobile/hr/transfers/counts${activeBranch ? `?branchId=${activeBranch}` : ''}`),
    edit
      ? backendFetch<TransferRow>(`/api/mobile/hr/transfers/${edit}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const branchOptions = branches.map((b) => ({ id: b.id, label: `${b.code} · ${b.name}` }));
  const employeeOptions = employees.map((e) => ({ id: e.id, label: `${e.code} · ${e.firstName} ${e.lastName}` }));
  const employeeDetails: Record<
    string,
    {
      branchId: string;
      employeeLabel: string;
      branch: string;
      department: string;
      designation: string;
      shift: string;
    }
  > = {};
  for (const e of employees) {
    employeeDetails[e.id] = {
      branchId: e.branchId,
      employeeLabel: `${e.code} - ${e.firstName} ${e.lastName}`,
      branch: e.branchName ?? '-',
      department: e.department ?? '-',
      designation: e.designation ?? '-',
      shift: e.shiftName ?? '-',
    };
  }
  const shiftOptions = shifts.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  const EXCLUDED_DEPARTMENTS = ['Admin', 'Super Admin'];
  const departmentNames = departmentRows.map((d) => d.name).filter((name) => !EXCLUDED_DEPARTMENTS.includes(name));

  const isEditing = Boolean(editTransfer && editTransfer.status === 'DRAFT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Transfer"
        description="Manage branch, department, shift, temporary, and permanent employee transfers with approval workflow."
      />

      <TransferKpiCards counts={counts} />

      {canWrite && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              {isEditing ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <PlusCircle className="h-4 w-4 text-primary" />
              )}
              {isEditing ? 'Edit Transfer' : 'New Transfer Request'}
            </div>
            <TransferForm
              mode={isEditing ? 'edit' : 'create'}
              branches={branchOptions}
              employees={employeeOptions}
              employeeDetails={employeeDetails}
              shifts={shiftOptions}
              departments={departmentNames}
              initial={
                isEditing && editTransfer
                  ? {
                      id: editTransfer.id,
                      branchId: editTransfer.branchId,
                      employeeId: editTransfer.employeeId,
                      transferType: editTransfer.transferType,
                      reason: editTransfer.reason,
                      remarks: editTransfer.remarks,
                      newReportingManagerId: editTransfer.newReportingManagerId,
                      newBranchId: editTransfer.newBranchId,
                      newDepartment: editTransfer.newDepartment,
                      newShiftId: editTransfer.newShiftId,
                      tempBranchId: editTransfer.tempBranchId,
                      tempDepartment: editTransfer.tempDepartment,
                      tempShiftId: editTransfer.tempShiftId,
                      startDate: editTransfer.startDate ? new Date(editTransfer.startDate) : null,
                      endDate: editTransfer.endDate ? new Date(editTransfer.endDate) : null,
                      effectiveDate: editTransfer.effectiveDate ? new Date(editTransfer.effectiveDate) : null,
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
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Transfer Records
            </div>
          </div>
          <TransferTable
            transfers={transfers.map((t) => ({
              id: t.id,
              transferNumber: t.transferNumber,
              transferType: t.transferType,
              status: t.status,
              reason: t.reason,
              effectiveDate: t.effectiveDate ? new Date(t.effectiveDate) : null,
              startDate: t.startDate ? new Date(t.startDate) : null,
              endDate: t.endDate ? new Date(t.endDate) : null,
              createdAt: new Date(t.createdAt),
              employee: t.employee,
              branch: t.branch,
              newBranch: t.newBranch,
              tempBranch: t.tempBranch,
              newShift: t.newShift,
              tempShift: t.tempShift,
              newDepartment: t.newDepartment,
              tempDepartment: t.tempDepartment,
            }))}
            canWrite={canWrite}
          />
        </CardContent>
      </Card>
    </div>
  );
}
