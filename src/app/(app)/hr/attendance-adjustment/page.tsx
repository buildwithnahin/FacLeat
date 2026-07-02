import { ClipboardCheck, TimerReset } from 'lucide-react';
import { authorize } from '@/server/auth/authorize';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import {
  ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE,
  attendanceAdjustmentsService,
  isAttendanceAdjustmentTableAvailable,
} from '@/server/services/attendance-adjustments.service';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  AttendanceAdjustmentForm,
  AttendanceAdjustmentTable,
} from './attendance-adjustment-components';

export const metadata = { title: 'Attendance Adjustment - HR' };

function hoursFromMinutes(minutes: number) {
  return `${(minutes / 60).toFixed(1)} hrs`;
}

export default async function AttendanceAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; date?: string; error?: string; status?: string; q?: string }>;
}) {
  const { edit, date, error, status, q } = await searchParams;
  const session = await getSession();
  await authorize(session, 'hr:attendance');

  const activeBranch = session?.activeBranchId ?? undefined;
  const selectedDate = date ?? new Date().toISOString().slice(0, 10);
  const day = new Date(selectedDate);
  const available = await isAttendanceAdjustmentTableAvailable();

  const [employees, shifts, attendance, holidays, listResult, editResult] = await Promise.all([
    prisma.employee.findMany({
      where: {
        branchId: activeBranch,
        status: { in: ['ACTIVE', 'ON_LEAVE'] },
      },
      include: {
        branch: true,
        shift: true,
      },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.shift.findMany({
      where: { branchId: activeBranch, status: 'ACTIVE' },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.attendanceRecord.findMany({
      where: {
        employee: activeBranch ? { branchId: activeBranch } : undefined,
        date: day,
      },
      include: { employee: true },
    }),
    prisma.holiday.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: day },
        endDate: { gte: day },
        OR: activeBranch ? [{ branchId: activeBranch }, { branchId: null }] : [{ branchId: null }],
      },
    }),
    available
      ? attendanceAdjustmentsService
          .list(session, {
            branchId: activeBranch,
            status,
            q,
          })
          .then((records) => ({ records, unavailable: false }))
          .catch(() => ({ records: [], unavailable: true }))
      : Promise.resolve({ records: [], unavailable: true }),
    available && edit
      ? attendanceAdjustmentsService
          .getById(session, edit)
          .then((record) => ({ record, unavailable: false }))
          .catch(() => ({ record: null, unavailable: false }))
      : Promise.resolve({ record: null, unavailable: false }),
  ]);

  const adjustedByIds = [...new Set(listResult.records.map((row) => row.adjustedById).filter(Boolean))];
  const adjustedByUsers = adjustedByIds.length
    ? await prisma.user.findMany({
        where: { id: { in: adjustedByIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const adjustedByMap = new Map(
    adjustedByUsers.map((user) => [user.id, user.name || user.email || 'HR User']),
  );

  const holidayBranchIds = new Set(holidays.map((holiday) => holiday.branchId).filter(Boolean));
  const globalHoliday = holidays.some((holiday) => holiday.branchId === null);
  const attendanceByEmployee = Object.fromEntries(
    employees.map((employee) => {
      const row = attendance.find((item) => item.employeeId === employee.id);
      const workedMinutes = row?.checkIn && row?.checkOut ? Math.max(0, Math.floor((row.checkOut.getTime() - row.checkIn.getTime()) / 60000)) : 0;
      const inferredStatus = row?.status ?? (globalHoliday || holidayBranchIds.has(employee.branchId) ? 'HOLIDAY' : 'ABSENT');
      return [
        employee.id,
        {
          checkIn: row?.checkIn ? row.checkIn.toISOString().slice(11, 16) : '-',
          checkOut: row?.checkOut ? row.checkOut.toISOString().slice(11, 16) : '-',
          status: inferredStatus,
          workedHours: hoursFromMinutes(workedMinutes),
          otHours: 'Auto on save',
        },
      ];
    }),
  );

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
    employeeCode: employee.code,
    branch: employee.branch.name,
    department: employee.department ?? '-',
    designation: employee.designation ?? '-',
    shiftId: employee.shiftId ?? '',
    shiftName: employee.shift?.name ?? '-',
  }));

  const shiftOptions = shifts.map((shift) => ({
    id: shift.id,
    label: `${shift.code} · ${shift.name}`,
  }));

  const records = listResult.records.map((record) => ({
    id: record.id,
    adjustmentNumber: record.adjustmentNumber,
    employeeId: record.employeeId,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    employeeCode: record.employee.code,
    attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
    adjustmentType: record.adjustmentType,
    oldStatus: record.oldStatus,
    newStatus: record.newStatus,
    adjustedBy: adjustedByMap.get(record.adjustedById) ?? 'HR User',
    status: record.status,
    reason: record.reason,
    remarks: record.remarks ?? '',
    attachmentUrl: record.attachmentUrl ?? '',
    oldCheckIn: record.oldCheckIn ? record.oldCheckIn.toISOString().slice(11, 16) : '-',
    oldCheckOut: record.oldCheckOut ? record.oldCheckOut.toISOString().slice(11, 16) : '-',
    oldWorkingHours: hoursFromMinutes(record.oldWorkingMinutes),
    oldOtHours: hoursFromMinutes(record.oldOtMinutes),
    newCheckIn: record.newCheckIn ? record.newCheckIn.toISOString().slice(11, 16) : '',
    newCheckOut: record.newCheckOut ? record.newCheckOut.toISOString().slice(11, 16) : '',
    newShiftId: record.newShiftId ?? '',
  }));

  const editRecord = editResult.record
    ? records.find((record) => record.id === editResult.record?.id) ?? null
    : null;
  const tableUnavailable = !available || listResult.unavailable || editResult.unavailable;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Adjustment"
        description="Correct missed punches, shift mismatches, official duty, holiday work, and other attendance errors without an approval chain."
      >
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">
            Go
          </button>
        </form>
      </PageHeader>

      {tableUnavailable ? (
        <AlertBanner tone="warning" title="Attendance adjustment migration required">
          {ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE}
        </AlertBanner>
      ) : null}

      {error ? (
        <AlertBanner tone="warning" title="Attendance adjustment blocked">
          {error}
        </AlertBanner>
      ) : null}

      {!tableUnavailable ? (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Attendance Adjustment Form
            </div>
            <AttendanceAdjustmentForm
              employees={employeeOptions}
              shifts={shiftOptions}
              snapshots={attendanceByEmployee}
              date={selectedDate}
              initial={editRecord}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TimerReset className="h-4 w-4 text-primary" />
              Attendance Adjustment Records
            </div>
          </div>
          <AttendanceAdjustmentTable records={records} selectedId={editRecord?.id} />
        </CardContent>
      </Card>
    </div>
  );
}
