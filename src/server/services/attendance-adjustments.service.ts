import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { recordAudit } from '@/server/audit/logger';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  AttendanceAdjustmentCancelInput,
  AttendanceAdjustmentUpsertInput,
} from '@/server/validators/attendance-adjustments';

const ZERO = new Prisma.Decimal(0);
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const TABLE_CACHE_TTL_MS = 60_000;
const ATTENDANCE_ADJUSTMENT_TABLE_UNAVAILABLE_MESSAGE =
  'Attendance adjustments are not available yet because the AttendanceAdjustment table has not been migrated in this database.';

let tableAvailabilityCache:
  | {
      checkedAt: number;
      available: boolean;
    }
  | undefined;

type ShiftSnapshot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateGraceMinutes: number;
  earlyExitGraceMinutes: number;
  overtimeAllowed: boolean;
  otStartsAfter: string | null;
  minOtMinutes: number;
  maxOtMinutesPerDay: number;
};

const attendanceAdjustmentIncludes = {
  branch: { select: { id: true, code: true, name: true } },
  employee: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      branchId: true,
      department: true,
      designation: true,
      shiftId: true,
      joinedAt: true,
      shift: {
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          lateGraceMinutes: true,
          earlyExitGraceMinutes: true,
          overtimeAllowed: true,
          otStartsAfter: true,
          minOtMinutes: true,
          maxOtMinutesPerDay: true,
        },
      },
    },
  },
  oldShift: {
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
    },
  },
  newShift: {
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
    },
  },
} as const;

function parseTimeOn(date: Date, hhmm: string | null | undefined) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}

function timeString(date: Date | null | undefined) {
  if (!date) return '';
  return date.toISOString().slice(11, 16);
}

function minutesBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 60000);
  return Math.max(0, diff);
}

function getShiftStart(date: Date, shift: ShiftSnapshot | null) {
  return shift ? parseTimeOn(date, shift.startTime) : null;
}

function getShiftEnd(date: Date, shift: ShiftSnapshot | null) {
  return shift ? parseTimeOn(date, shift.endTime) : null;
}

function computeOvertimeMinutes(date: Date, shift: ShiftSnapshot | null, checkIn: Date | null, checkOut: Date | null, status: string) {
  if (!checkIn || !checkOut) return 0;
  const workedMinutes = minutesBetween(checkIn, checkOut);
  if (['HOLIDAY', 'WEEKEND'].includes(status)) return workedMinutes;
  if (!shift?.overtimeAllowed) return 0;

  const threshold = shift.otStartsAfter ? parseTimeOn(date, shift.otStartsAfter) : getShiftEnd(date, shift);
  if (!threshold || checkOut <= threshold) return 0;
  let otMinutes = minutesBetween(threshold, checkOut);
  if (shift.minOtMinutes > 0 && otMinutes < shift.minOtMinutes) otMinutes = 0;
  if (shift.maxOtMinutesPerDay > 0) {
    otMinutes = Math.min(otMinutes, shift.maxOtMinutesPerDay);
  }
  return otMinutes;
}

function computeMetrics(input: {
  date: Date;
  shift: ShiftSnapshot | null;
  status: string;
  checkIn: Date | null;
  checkOut: Date | null;
}) {
  const workedMinutes = minutesBetween(input.checkIn, input.checkOut);
  const shiftStart = getShiftStart(input.date, input.shift);
  const shiftEnd = getShiftEnd(input.date, input.shift);
  const lateThreshold = shiftStart
    ? new Date(shiftStart.getTime() + (input.shift?.lateGraceMinutes ?? 0) * 60000)
    : null;
  const earlyThreshold = shiftEnd
    ? new Date(shiftEnd.getTime() - (input.shift?.earlyExitGraceMinutes ?? 0) * 60000)
    : null;

  const lateMinutes =
    input.checkIn && lateThreshold && input.checkIn > lateThreshold
      ? minutesBetween(lateThreshold, input.checkIn)
      : 0;
  const earlyMinutes =
    input.checkOut && earlyThreshold && input.checkOut < earlyThreshold
      ? minutesBetween(input.checkOut, earlyThreshold)
      : 0;
  const otMinutes = computeOvertimeMinutes(input.date, input.shift, input.checkIn, input.checkOut, input.status);

  return {
    workedMinutes,
    lateMinutes,
    earlyMinutes,
    otMinutes,
  };
}

function monthBounds(period: string) {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const workingDays = end.getUTCDate();
  return { start, end, workingDays };
}

async function defaultStatusForDate(branchId: string, date: Date) {
  const holiday = await prisma.holiday.findFirst({
    where: {
      status: 'ACTIVE',
      startDate: { lte: date },
      endDate: { gte: date },
      OR: [{ branchId }, { branchId: null }],
    },
    select: { id: true },
  });
  return holiday ? 'HOLIDAY' : 'ABSENT';
}

async function nextAdjustmentNumber(attendanceDate: Date) {
  const year = attendanceDate.getUTCFullYear();
  const prefix = `ADJ-${year}-`;
  const last = await prisma.attendanceAdjustment.findFirst({
    where: { adjustmentNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { adjustmentNumber: true },
  });
  const lastSeq = last ? parseInt(last.adjustmentNumber.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
}

async function assertTableAvailable() {
  const available = await isAttendanceAdjustmentTableAvailable();
  if (!available) throw new ValidationError(ATTENDANCE_ADJUSTMENT_TABLE_UNAVAILABLE_MESSAGE);
}

async function recalcPayslipForEmployee(
  tx: Prisma.TransactionClient,
  employeeId: string,
  payrollRunId: string,
) {
  const run = await tx.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: { branch: true },
  });
  if (!run || ['LOCKED', 'CANCELLED'].includes(run.status)) return false;

  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return false;

  const { start, end, workingDays } = monthBounds(run.period);
  const [attendance, leaves, activeHolidays] = await Promise.all([
    tx.attendanceRecord.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
    }),
    tx.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        fromDate: { lte: end },
        toDate: { gte: start },
      },
    }),
    tx.holiday.findMany({
      where: {
        startDate: { lte: end },
        endDate: { gte: start },
        status: 'ACTIVE',
        OR: [{ branchId: employee.branchId }, { branchId: null }],
      },
    }),
  ]);

  let leaveDays = 0;
  for (const leave of leaves) {
    const from = leave.fromDate < start ? start : leave.fromDate;
    const to = leave.toDate > end ? end : leave.toDate;
    const cursor = new Date(from);
    while (cursor <= to) {
      const isHoliday = activeHolidays.some(
        (holiday) =>
          cursor >= holiday.startDate &&
          cursor <= holiday.endDate &&
          (holiday.branchId === null || holiday.branchId === employee.branchId),
      );
      if (!isHoliday) leaveDays += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const fullDays = attendance.filter((row) => ['PRESENT', 'LATE', 'OFFICIAL_DUTY'].includes(row.status)).length;
  const halfDays = attendance.filter((row) => row.status === 'HALF_DAY').length;
  const absentDays = attendance.filter((row) => row.status === 'ABSENT').length;
  const workedDays = Math.min(workingDays, Math.max(0, fullDays + halfDays * 0.5));

  let paidHolidaysCount = 0;
  const processedHolidayDates = new Set<string>();
  for (const holiday of activeHolidays) {
    if (!holiday.isPaid) continue;
    const hStart = new Date(Math.max(holiday.startDate.getTime(), start.getTime()));
    const hEnd = new Date(Math.min(holiday.endDate.getTime(), end.getTime()));
    const cursor = new Date(hStart);
    while (cursor <= hEnd) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (!processedHolidayDates.has(dateStr)) {
        processedHolidayDates.add(dateStr);
        const attOnHoliday = attendance.find((row) => row.date.toISOString().slice(0, 10) === dateStr);
        if (!attOnHoliday || ['HOLIDAY', 'ABSENT', 'ON_LEAVE', 'WEEKEND'].includes(attOnHoliday.status)) {
          paidHolidaysCount += 1;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const paidDays = Math.min(workingDays, workedDays + leaveDays + paidHolidaysCount);
  const paidRatio = D(paidDays).div(workingDays).toNumber();
  const basic = employee.basicSalary.mul(D(paidRatio));
  const houseAllowance = employee.houseAllowance.mul(D(paidRatio));
  const transportAllowance = employee.transportAllowance.mul(D(paidRatio));
  const medicalAllowance = employee.medicalAllowance.mul(D(paidRatio));
  const otherAllowance = employee.otherAllowance.mul(D(paidRatio));
  const gross = basic.plus(houseAllowance).plus(transportAllowance).plus(medicalAllowance).plus(otherAllowance);
  const providentFund = employee.providentFund;
  const taxDeduction = employee.taxDeduction;
  const net = gross.minus(providentFund.plus(taxDeduction));

  await tx.payslip.upsert({
    where: {
      payrollRunId_employeeId: {
        payrollRunId,
        employeeId,
      },
    },
    create: {
      payrollRunId,
      employeeId,
      workedDays,
      leaveDays,
      absentDays,
      basic,
      houseAllowance,
      transportAllowance,
      medicalAllowance,
      otherAllowance,
      providentFund,
      taxDeduction,
      gross,
      net,
    },
    update: {
      workedDays,
      leaveDays,
      absentDays,
      basic,
      houseAllowance,
      transportAllowance,
      medicalAllowance,
      otherAllowance,
      providentFund,
      taxDeduction,
      gross,
      net,
    },
  });

  const totals = await tx.payslip.aggregate({
    where: { payrollRunId },
    _sum: {
      gross: true,
      providentFund: true,
      taxDeduction: true,
      net: true,
    },
  });

  const totalDeduction = (totals._sum.providentFund ?? ZERO).plus(totals._sum.taxDeduction ?? ZERO);
  await tx.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      totalGross: totals._sum.gross ?? ZERO,
      totalDeduction,
      totalNet: totals._sum.net ?? ZERO,
    },
  });

  return true;
}

async function getCurrentAttendanceSnapshot(employeeId: string, branchId: string, date: Date, shift: ShiftSnapshot | null) {
  const record = await prisma.attendanceRecord.findUnique({
    where: {
      employeeId_date: {
        employeeId,
        date,
      },
    },
  });

  const resolvedStatus = record?.status ?? (await defaultStatusForDate(branchId, date));
  const metrics = computeMetrics({
    date,
    shift,
    status: resolvedStatus,
    checkIn: record?.checkIn ?? null,
    checkOut: record?.checkOut ?? null,
  });

  return {
    record,
    status: resolvedStatus,
    checkIn: record?.checkIn ?? null,
    checkOut: record?.checkOut ?? null,
    ...metrics,
  };
}

export async function isAttendanceAdjustmentTableAvailable(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && tableAvailabilityCache && now - tableAvailabilityCache.checkedAt < TABLE_CACHE_TTL_MS) {
    return tableAvailabilityCache.available;
  }

  const rows = await prisma.$queryRaw<Array<{ exists: boolean | number }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'AttendanceAdjustment'
    ) AS "exists"
  `;
  const available = Boolean(rows[0]?.exists);
  tableAvailabilityCache = { checkedAt: now, available };
  return available;
}

export const ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE = ATTENDANCE_ADJUSTMENT_TABLE_UNAVAILABLE_MESSAGE;

export const attendanceAdjustmentsService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; q?: string; attendanceDate?: Date } = {},
  ) {
    await authorize(session, 'hr:attendance');
    await assertTableAvailable();
    return prisma.attendanceAdjustment.findMany({
      where: {
        branchId: filters.branchId,
        status: filters.status as never,
        attendanceDate: filters.attendanceDate,
        OR: filters.q
          ? [
              { adjustmentNumber: { contains: filters.q, mode: 'insensitive' } },
              { employee: { firstName: { contains: filters.q, mode: 'insensitive' } } },
              { employee: { lastName: { contains: filters.q, mode: 'insensitive' } } },
              { employee: { code: { contains: filters.q, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: attendanceAdjustmentIncludes,
      orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:attendance');
    await assertTableAvailable();
    const row = await prisma.attendanceAdjustment.findUnique({
      where: { id },
      include: attendanceAdjustmentIncludes,
    });
    if (!row) throw new NotFoundError('Attendance adjustment not found');
    return row;
  },

  async save(session: AppSession | null, input: AttendanceAdjustmentUpsertInput) {
    const actor = await authorize(session, 'hr:attendance');
    await assertTableAvailable();

    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            lateGraceMinutes: true,
            earlyExitGraceMinutes: true,
            overtimeAllowed: true,
            otStartsAfter: true,
            minOtMinutes: true,
            maxOtMinutesPerDay: true,
          },
        },
      },
    });
    if (!employee) throw new NotFoundError('Employee not found');

    const selectedShift = input.newShiftId
      ? await prisma.shift.findUnique({
          where: { id: input.newShiftId },
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            lateGraceMinutes: true,
            earlyExitGraceMinutes: true,
            overtimeAllowed: true,
            otStartsAfter: true,
            minOtMinutes: true,
            maxOtMinutesPerDay: true,
          },
        })
      : employee.shift;

    if (input.newShiftId && !selectedShift) throw new ValidationError('Selected new shift was not found');

    const current = await getCurrentAttendanceSnapshot(employee.id, employee.branchId, input.attendanceDate, employee.shift);
    const newCheckIn = input.newCheckIn ? parseTimeOn(input.attendanceDate, input.newCheckIn) : null;
    const newCheckOut = input.newCheckOut ? parseTimeOn(input.attendanceDate, input.newCheckOut) : null;
    const newMetrics = computeMetrics({
      date: input.attendanceDate,
      shift: selectedShift,
      status: input.newStatus,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
    });

    const existing = input.id
      ? await prisma.attendanceAdjustment.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !existing) {
      throw new NotFoundError('Attendance adjustment not found');
    }
    if (existing && existing.status === 'CANCELLED') {
      throw new ValidationError('Cancelled adjustments cannot be edited');
    }
    if (existing && existing.status === 'UPDATED') {
      throw new ValidationError('Updated attendance adjustments cannot be edited');
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      let adjustmentId = existing?.id;
      let adjustmentNumber = existing?.adjustmentNumber;

      if (!adjustmentNumber) {
        adjustmentNumber = await nextAdjustmentNumber(input.attendanceDate);
      }

      const data: Prisma.AttendanceAdjustmentUncheckedCreateInput | Prisma.AttendanceAdjustmentUncheckedUpdateInput = {
        branchId: employee.branchId,
        employeeId: employee.id,
        attendanceDate: input.attendanceDate,
        adjustmentType: input.adjustmentType,
        reason: input.reason,
        remarks: input.remarks || null,
        attachmentUrl: input.attachmentUrl || null,
        adjustedById: actor.userId,
        adjustedAt: input.intent === 'apply' ? now : existing?.adjustedAt ?? null,
        status: input.intent === 'apply' ? 'UPDATED' : 'DRAFT',
        oldShiftId: employee.shiftId ?? null,
        newShiftId: input.newShiftId || null,
        oldCheckIn: current.checkIn,
        oldCheckOut: current.checkOut,
        oldStatus: current.status as never,
        oldWorkingMinutes: current.workedMinutes,
        oldOtMinutes: current.otMinutes,
        oldLateMinutes: current.lateMinutes,
        oldEarlyMinutes: current.earlyMinutes,
        newCheckIn,
        newCheckOut,
        newStatus: input.newStatus as never,
        newWorkingMinutes: newMetrics.workedMinutes,
        newOtMinutes: newMetrics.otMinutes,
        newLateMinutes: newMetrics.lateMinutes,
        newEarlyMinutes: newMetrics.earlyMinutes,
      };

      const saved = existing
        ? await tx.attendanceAdjustment.update({
            where: { id: existing.id },
            data,
            include: attendanceAdjustmentIncludes,
          })
        : await tx.attendanceAdjustment.create({
            data: {
              adjustmentNumber,
              ...data,
            } as Prisma.AttendanceAdjustmentUncheckedCreateInput,
            include: attendanceAdjustmentIncludes,
          });

      let payrollUpdated = false;
      if (input.intent === 'apply') {
        await tx.attendanceRecord.upsert({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: input.attendanceDate,
            },
          },
          create: {
            employeeId: employee.id,
            date: input.attendanceDate,
            status: input.newStatus as never,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            remarks: input.remarks || input.reason,
            createdById: actor.userId,
          },
          update: {
            status: input.newStatus as never,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            remarks: input.remarks || input.reason,
          },
        });

        const period = input.attendanceDate.toISOString().slice(0, 7);
        const run = await tx.payrollRun.findUnique({
          where: {
            branchId_period: {
              branchId: employee.branchId,
              period,
            },
          },
        });
        if (run && !['LOCKED', 'CANCELLED'].includes(run.status)) {
          payrollUpdated = await recalcPayslipForEmployee(tx, employee.id, run.id);
        }
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: employee.branchId,
          module: 'hr',
          action: input.intent === 'apply' ? 'attendance-adjustment-apply' : 'attendance-adjustment-save-draft',
          entityType: 'AttendanceAdjustment',
          entityId: saved.id,
          before: existing
            ? {
                status: existing.status,
                oldStatus: existing.oldStatus,
                newStatus: existing.newStatus,
              }
            : undefined,
          after: {
            status: saved.status,
            oldStatus: saved.oldStatus,
            newStatus: saved.newStatus,
            oldCheckIn: timeString(saved.oldCheckIn),
            oldCheckOut: timeString(saved.oldCheckOut),
            newCheckIn: timeString(saved.newCheckIn),
            newCheckOut: timeString(saved.newCheckOut),
            payrollUpdated,
          },
          summary: `${saved.adjustmentNumber} ${input.intent === 'apply' ? 'updated attendance' : 'saved as draft'} for ${employee.code}`,
        },
        tx,
      );

      adjustmentId = saved.id;
      if (!adjustmentId) throw new ValidationError('Could not save attendance adjustment');
      return saved;
    });
  },

  async cancel(session: AppSession | null, input: AttendanceAdjustmentCancelInput) {
    const actor = await authorize(session, 'hr:attendance');
    await assertTableAvailable();
    const existing = await prisma.attendanceAdjustment.findUnique({
      where: { id: input.id },
    });
    if (!existing) throw new NotFoundError('Attendance adjustment not found');
    if (existing.status === 'UPDATED') {
      throw new ValidationError('Updated attendance adjustments cannot be cancelled');
    }

    return prisma.$transaction(async (tx) => {
      const row = await tx.attendanceAdjustment.update({
        where: { id: input.id },
        data: {
          status: 'CANCELLED',
          adjustedById: actor.userId,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: row.branchId,
          module: 'hr',
          action: 'attendance-adjustment-cancel',
          entityType: 'AttendanceAdjustment',
          entityId: row.id,
          before: { status: existing.status },
          after: { status: row.status },
        },
        tx,
      );
      return row;
    });
  },
};
