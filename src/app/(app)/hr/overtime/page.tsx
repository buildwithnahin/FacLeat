import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { overtimeService } from '@/server/services/overtime.service';
import { prisma } from '@/server/db';
import { hrService } from '@/server/services/hr.service';
import {
  OvertimePageHeader,
  OvertimeSummaryCards,
  OvertimeGenerateForm,
  OvertimeTable,
  OvertimeDetailPanel,
} from './overtime-components';
import type { OtRow } from './overtime-components';
import { OVERTIME_TYPE_LABELS, OVERTIME_SOURCE_LABELS, OVERTIME_RATE_TYPE_LABELS } from '@/server/validators/overtime';

export const metadata = {
  title: 'Overtime – HR',
  description: 'Generate, approve, and post employee overtime to payroll.',
};

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  await authorize(session, 'hr:read');

  const activeBranch = session?.activeBranchId ?? undefined;
  const today = new Date().toISOString().slice(0, 10);

  const [branches, shifts, employees, records] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.shift.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    hrService.listEmployees(session, { status: 'ACTIVE' }),
    overtimeService.list(session, {
      branchId: sp.branchId || activeBranch,
      status: sp.status || undefined,
      otMonth: sp.otMonth || undefined,
      employeeId: sp.employeeId || undefined,
      q: sp.q || undefined,
    }),
  ]);

  // Unique departments
  const deptSet = new Set<string>();
  for (const e of employees) {
    if (e.department) deptSet.add(e.department);
  }

  const branchOptions = branches.map((b) => ({ id: b.id, label: `${b.code} · ${b.name}` }));
  const deptOptions = Array.from(deptSet).sort().map((d) => ({ id: d, label: d }));
  const shiftOptions = shifts.map((s) => ({ id: s.id, label: `${s.code} · ${s.name}` }));
  const empOptions = employees.map((e) => ({ id: e.id, label: `${e.code} · ${e.firstName} ${e.lastName}` }));

  // Map records to table rows
  const rows: OtRow[] = records.map((r) => ({
    id: r.id,
    otNumber: r.otNumber,
    employeeCode: r.employee.code,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
    department: r.employee.department ?? '-',
    date: r.otDate.toISOString().slice(0, 10),
    shiftName: r.shift?.name ?? '-',
    checkOut: r.checkOut ? r.checkOut.toISOString().slice(11, 16) : '-',
    extraHours: `${(r.extraWorkedMinutes / 60).toFixed(1)}h`,
    approvedHours: `${(r.approvedOtMinutes / 60).toFixed(1)}h`,
    otAmount: Number(r.otAmount).toFixed(2),
    managerStatus: r.managerStatus ?? '-',
    hrStatus: r.hrStatus ?? '-',
    accountsStatus: r.accountsStatus ?? '-',
    status: r.status,
    source: r.source,
    otType: r.otType,
  }));

  // Summary
  const summary = {
    total: rows.length,
    draft: rows.filter((r) => r.status === 'DRAFT').length,
    pendingApproval: rows.filter((r) => r.status.startsWith('PENDING')).length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    posted: rows.filter((r) => r.status === 'POSTED_TO_PAYROLL').length,
    totalAmount: rows.reduce((s, r) => s + Number(r.otAmount), 0).toFixed(2),
  };

  // Detail record
  let detailRecord = null;
  if (sp.detail) {
    const raw = records.find((r) => r.id === sp.detail);
    if (raw) {
      detailRecord = {
        id: raw.id,
        otNumber: raw.otNumber,
        status: raw.status,
        otType: raw.otType,
        source: raw.source,
        employeeName: `${raw.employee.firstName} ${raw.employee.lastName}`,
        employeeCode: raw.employee.code,
        department: raw.employee.department ?? '-',
        designation: raw.employee.designation ?? '-',
        shiftName: raw.shift?.name ?? '-',
        shiftStart: raw.shift?.startTime ?? '-',
        shiftEnd: raw.shift?.endTime ?? '-',
        date: raw.otDate.toISOString().slice(0, 10),
        checkIn: raw.checkIn ? raw.checkIn.toISOString().slice(11, 16) : '-',
        checkOut: raw.checkOut ? raw.checkOut.toISOString().slice(11, 16) : '-',
        totalWorkedMinutes: raw.totalWorkedMinutes,
        regularDutyMinutes: raw.regularDutyMinutes,
        breakMinutes: raw.breakMinutes,
        extraWorkedMinutes: raw.extraWorkedMinutes,
        lateMinutes: raw.lateMinutes,
        earlyExitMinutes: raw.earlyExitMinutes,
        eligibleOtMinutes: raw.eligibleOtMinutes,
        approvedOtMinutes: raw.approvedOtMinutes,
        otRateType: raw.otRateType,
        otRatePerHour: Number(raw.otRatePerHour).toFixed(2),
        otAmount: Number(raw.otAmount).toFixed(2),
        managerStatus: raw.managerStatus ?? '-',
        managerRemarks: raw.managerRemarks ?? '',
        hrStatus: raw.hrStatus ?? '-',
        hrRemarks: raw.hrRemarks ?? '',
        accountsStatus: raw.accountsStatus ?? '-',
        accountsRemarks: raw.accountsRemarks ?? '',
        remarks: raw.remarks ?? '',
      };
    }
  }

  return (
    <div className="space-y-6">
      <OvertimePageHeader />

      <OvertimeSummaryCards summary={summary} />

      <OvertimeGenerateForm
        branches={branchOptions}
        departments={deptOptions}
        shifts={shiftOptions}
        employees={empOptions}
        defaultDate={today}
      />

      {detailRecord && <OvertimeDetailPanel record={detailRecord} />}

      <OvertimeTable rows={rows} selectedId={sp.detail} />
    </div>
  );
}
