import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import {
  ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE,
  attendanceAdjustmentsService,
  isAttendanceAdjustmentTableAvailable,
} from '@/server/services/attendance-adjustments.service';
import { attendanceAdjustmentUpsertSchema } from '@/server/validators/attendance-adjustments';

function hoursFromMinutes(minutes: number) {
  return `${(minutes / 60).toFixed(1)} hrs`;
}

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const activeBranch = session.activeBranchId ?? undefined;
  const selectedDate = sp.get('date') ?? new Date().toISOString().slice(0, 10);
  const day = new Date(selectedDate);
  const edit = sp.get('edit') ?? undefined;
  const status = sp.get('status') ?? undefined;
  const q = sp.get('q') ?? undefined;

  try {
    const available = await isAttendanceAdjustmentTableAvailable();

    const [employees, shifts, attendance, holidays, listResult, editResult] = await Promise.all([
      prisma.employee.findMany({
        where: { branchId: activeBranch, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        include: { branch: true, shift: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.shift.findMany({
        where: { branchId: activeBranch, status: 'ACTIVE' },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: { employee: activeBranch ? { branchId: activeBranch } : undefined, date: day },
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
            .list(session, { branchId: activeBranch, status, q })
            .then((records) => ({ records, unavailable: false }))
            .catch(() => ({ records: [] as Awaited<ReturnType<typeof attendanceAdjustmentsService.list>>, unavailable: true }))
        : Promise.resolve({ records: [] as Awaited<ReturnType<typeof attendanceAdjustmentsService.list>>, unavailable: true }),
      available && edit
        ? attendanceAdjustmentsService
            .getById(session, edit)
            .then((record) => ({ record, unavailable: false }))
            .catch(() => ({ record: null as Awaited<ReturnType<typeof attendanceAdjustmentsService.getById>> | null, unavailable: false }))
        : Promise.resolve({ record: null as Awaited<ReturnType<typeof attendanceAdjustmentsService.getById>> | null, unavailable: false }),
    ]);

    const adjustedByIds = [...new Set(listResult.records.map((row) => row.adjustedById).filter(Boolean))] as string[];
    const adjustedByUsers = adjustedByIds.length
      ? await prisma.user.findMany({ where: { id: { in: adjustedByIds } }, select: { id: true, name: true, email: true } })
      : [];
    const adjustedByMap = new Map(adjustedByUsers.map((user) => [user.id, user.name || user.email || 'HR User']));

    const holidayBranchIds = new Set(holidays.map((h) => h.branchId).filter(Boolean));
    const globalHoliday = holidays.some((h) => h.branchId === null);
    const attendanceByEmployee = Object.fromEntries(
      employees.map((employee) => {
        const row = attendance.find((item) => item.employeeId === employee.id);
        const workedMinutes =
          row?.checkIn && row?.checkOut ? Math.max(0, Math.floor((row.checkOut.getTime() - row.checkIn.getTime()) / 60000)) : 0;
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

    const shiftOptions = shifts.map((shift) => ({ id: shift.id, label: `${shift.code} · ${shift.name}` }));

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

    const editRecord = editResult.record ? records.find((record) => record.id === editResult.record?.id) ?? null : null;
    const tableUnavailable = !available || listResult.unavailable || editResult.unavailable;

    return Response.json(
      apiOk({
        selectedDate,
        tableUnavailable,
        tableUnavailableMessage: tableUnavailable ? ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE : null,
        employeeOptions,
        shiftOptions,
        attendanceByEmployee,
        records,
        editRecord,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/attendance-adjustments failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = attendanceAdjustmentUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const row = await attendanceAdjustmentsService.save(session, parsed.data);
    return Response.json(apiOk({ id: row.id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/attendance-adjustments failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
