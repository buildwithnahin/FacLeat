import { backendFetch } from '@/lib/backend-client';
import { OvertimePageHeader, OvertimeSummaryCards, OvertimeGenerateForm, OvertimeTable, OvertimeDetailPanel } from './overtime-components';
import type { OtRow } from './overtime-components';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Overtime – HR',
  description: 'Generate, approve, and post employee overtime to payroll.',
};

interface OvertimeRowDto extends OtRow {
  totalWorkedMinutes: number;
  regularDutyMinutes: number;
  breakMinutes: number;
  extraWorkedMinutes: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  eligibleOtMinutes: number;
  approvedOtMinutes: number;
  otRateType: string;
  otRatePerHour: string;
  managerRemarks: string;
  hrRemarks: string;
  accountsRemarks: string;
  remarks: string;
  shiftStart: string;
  shiftEnd: string;
  checkIn: string;
  department: string;
  designation: string;
}

interface OvertimeBundle {
  defaultDate: string;
  branches: { id: string; label: string }[];
  departments: { id: string; label: string }[];
  shifts: { id: string; label: string }[];
  employees: { id: string; label: string }[];
  rows: OvertimeRowDto[];
}

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const params = new URLSearchParams();
  if (sp.branchId) params.set('branchId', sp.branchId);
  if (sp.status) params.set('status', sp.status);
  if (sp.otMonth) params.set('otMonth', sp.otMonth);
  if (sp.employeeId) params.set('employeeId', sp.employeeId);
  if (sp.q) params.set('q', sp.q);

  const { defaultDate, branches, departments, shifts, employees, rows } = await backendFetch<OvertimeBundle>(
    `/api/mobile/hr/overtime?${params.toString()}`,
  );

  const summary = {
    total: rows.length,
    draft: rows.filter((r) => r.status === 'DRAFT').length,
    pendingApproval: rows.filter((r) => r.status.startsWith('PENDING')).length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    posted: rows.filter((r) => r.status === 'POSTED_TO_PAYROLL').length,
    totalAmount: rows.reduce((s, r) => s + Number(r.otAmount), 0).toFixed(2),
  };

  let detailRecord = null;
  if (sp.detail) {
    const raw = rows.find((r) => r.id === sp.detail);
    if (raw) {
      detailRecord = {
        id: raw.id,
        otNumber: raw.otNumber,
        status: raw.status,
        otType: raw.otType,
        source: raw.source,
        employeeName: raw.employeeName,
        employeeCode: raw.employeeCode,
        department: raw.department,
        designation: raw.designation,
        shiftName: raw.shiftName,
        shiftStart: raw.shiftStart,
        shiftEnd: raw.shiftEnd,
        date: raw.date,
        checkIn: raw.checkIn,
        checkOut: raw.checkOut,
        totalWorkedMinutes: raw.totalWorkedMinutes,
        regularDutyMinutes: raw.regularDutyMinutes,
        breakMinutes: raw.breakMinutes,
        extraWorkedMinutes: raw.extraWorkedMinutes,
        lateMinutes: raw.lateMinutes,
        earlyExitMinutes: raw.earlyExitMinutes,
        eligibleOtMinutes: raw.eligibleOtMinutes,
        approvedOtMinutes: raw.approvedOtMinutes,
        otRateType: raw.otRateType,
        otRatePerHour: raw.otRatePerHour,
        otAmount: raw.otAmount,
        managerStatus: raw.managerStatus,
        managerRemarks: raw.managerRemarks,
        hrStatus: raw.hrStatus,
        hrRemarks: raw.hrRemarks,
        accountsStatus: raw.accountsStatus,
        accountsRemarks: raw.accountsRemarks,
        remarks: raw.remarks,
      };
    }
  }

  return (
    <div className="space-y-6">
      <OvertimePageHeader />

      <OvertimeSummaryCards summary={summary} />

      <OvertimeGenerateForm branches={branches} departments={departments} shifts={shifts} employees={employees} defaultDate={defaultDate} />

      {detailRecord && <OvertimeDetailPanel record={detailRecord} />}

      <OvertimeTable rows={rows} selectedId={sp.detail} />
    </div>
  );
}
