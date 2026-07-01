import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { transfersService } from '@/server/services/transfers.service';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle, Pencil, ArrowRightLeft } from 'lucide-react';
import {
  TransferForm,
  TransferTable,
  TransferKpiCards,
} from './transfer-components';

export const metadata = { title: 'Employee Transfer — HR' };

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; type?: string; status?: string; q?: string }>;
}) {
  const { edit, type, status, q } = await searchParams;
  const session = await getSession();
  await authorize(session, 'hr:read');

  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const activeBranch = session?.activeBranchId ?? undefined;

  // Fetch all required data in parallel
  const [branches, employees, shifts, departmentRows, transfers, counts, editTransfer] =
    await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      hrService.listEmployees(session, { status: 'ACTIVE' }),
      prisma.shift.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      hrService.listMasterData(session, { type: 'departments' }),
      transfersService.list(session, {
        branchId: activeBranch,
        transferType: type,
        status,
        q,
      }),
      transfersService.countByStatus(session, activeBranch),
      edit
        ? transfersService.getById(session, edit).catch(() => null)
        : Promise.resolve(null),
    ]);

  const branchOptions = branches.map((b) => ({
    id: b.id,
    label: `${b.code} · ${b.name}`,
  }));
  const employeeOptions = employees.map((e) => ({
    id: e.id,
    label: `${e.code} · ${e.firstName} ${e.lastName}`,
  }));
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
      branch: e.branch?.name ?? '-',
      department: e.department ?? '-',
      designation: e.designation ?? '-',
      shift: e.shift?.name ?? '-',
    };
  }
  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    label: `${s.code} · ${s.name}`,
  }));
  const EXCLUDED_DEPARTMENTS = ['Admin', 'Super Admin'];
  const departmentNames = departmentRows
    .map((d) => d.name)
    .filter((name) => !EXCLUDED_DEPARTMENTS.includes(name));

  const isEditing = Boolean(editTransfer && editTransfer.status === 'DRAFT');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Transfer"
        description="Manage branch, department, shift, temporary, and permanent employee transfers with approval workflow."
      />

      {/* KPI Cards */}
      <TransferKpiCards counts={counts} />

      {/* Create / Edit Form */}
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
                      startDate: editTransfer.startDate,
                      endDate: editTransfer.endDate,
                      effectiveDate: editTransfer.effectiveDate,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Transfer List */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Transfer Records
            </div>
          </div>
          <TransferTable transfers={transfers} canWrite={canWrite} />
        </CardContent>
      </Card>
    </div>
  );
}
