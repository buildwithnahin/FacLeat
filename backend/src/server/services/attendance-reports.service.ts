import 'server-only';

import type { Prisma } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';

export const ATTENDANCE_REPORT_TYPES = [
  'DAILY_ATTENDANCE',
  'MONTHLY_ATTENDANCE',
  'ATTENDANCE_SUMMARY',
  'LATE_ARRIVAL',
  'EARLY_EXIT',
  'OVERTIME',
  'MISSING_ATTENDANCE',
  'ABSENT',
  'SHIFT_ATTENDANCE',
  'ATTENDANCE_ADJUSTMENT',
] as const;

export type AttendanceReportType = (typeof ATTENDANCE_REPORT_TYPES)[number];

export type AttendanceReportFilters = {
  reportType?: AttendanceReportType;
  branchId?: string;
  department?: string;
  designation?: string;
  shiftId?: string;
  employeeId?: string;
  employmentType?: string;
  attendanceStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

type EmployeeRecord = Prisma.EmployeeGetPayload<{
  include: {
    branch: { select: { id: true; code: true; name: true } };
    shift: {
      select: {
        id: true;
        code: true;
        name: true;
        startTime: true;
        endTime: true;
        breakStart: true;
        breakEnd: true;
        weeklyOffDays: true;
        lateGraceMinutes: true;
        earlyExitGraceMinutes: true;
        overtimeAllowed: true;
        minOtMinutes: true;
        maxOtMinutesPerDay: true;
      };
    };
  };
}>;

type AttendanceRecordWithEmployee = Prisma.AttendanceRecordGetPayload<{
  include: {
    employee: {
      include: {
        branch: { select: { id: true; code: true; name: true } };
        shift: {
          select: {
            id: true;
            code: true;
            name: true;
            startTime: true;
            endTime: true;
            breakStart: true;
            breakEnd: true;
            weeklyOffDays: true;
            lateGraceMinutes: true;
            earlyExitGraceMinutes: true;
            overtimeAllowed: true;
            minOtMinutes: true;
            maxOtMinutesPerDay: true;
          };
        };
      };
    };
  };
}>;

type AdjustmentRecordWithRelations = Prisma.AttendanceAdjustmentGetPayload<{
  include: {
    employee: {
      include: {
        branch: { select: { id: true; code: true; name: true } };
        shift: { select: { id: true; code: true; name: true } };
      };
    };
    oldShift: { select: { id: true; code: true; name: true } };
    newShift: { select: { id: true; code: true; name: true } };
  };
}>;

type OvertimeRecordWithRelations = Prisma.OvertimeRecordGetPayload<{
  include: {
    employee: {
      include: {
        branch: { select: { id: true; code: true; name: true } };
        shift: { select: { id: true; code: true; name: true } };
      };
    };
    branch: { select: { id: true; code: true; name: true } };
    shift: { select: { id: true; code: true; name: true } };
  };
}>;

type HolidayRecord = Prisma.HolidayGetPayload<{
  select: {
    id: true;
    name: true;
    branchId: true;
    startDate: true;
    endDate: true;
    status: true;
  };
}>;

type DerivedAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'EARLY_EXIT'
  | 'LATE_EARLY'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEKEND'
  | 'OFFICIAL_DUTY'
  | 'MISSING';

type DailyEntry = {
  key: string;
  date: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  department: string;
  designation: string;
  shiftId: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  employmentType: string;
  checkIn: Date | null;
  checkOut: Date | null;
  workingMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  calculatedOtMinutes: number;
  recordedOtMinutes: number;
  status: DerivedAttendanceStatus;
  remarks: string;
  isWorkingDay: boolean;
};

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStartString() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function normalizeDateStart(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function normalizeDateEnd(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function minutesToHHMM(totalMinutes: number) {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '—';
}

function formatTime(value: Date | null | undefined) {
  return value ? value.toISOString().slice(11, 16) : '—';
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function shiftTimeToMinutes(value: string | null | undefined) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function dateToMinutes(value: Date | null | undefined) {
  if (!value) return 0;
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

function breakMinutes(shift: EmployeeRecord['shift']) {
  if (!shift?.breakStart || !shift?.breakEnd) return 0;
  return Math.max(0, shiftTimeToMinutes(shift.breakEnd) - shiftTimeToMinutes(shift.breakStart));
}

function isWeeklyOff(date: Date, weeklyOffDaysJson: Prisma.JsonValue | null | undefined) {
  if (!weeklyOffDaysJson) return date.getUTCDay() === 5;
  if (!Array.isArray(weeklyOffDaysJson)) return date.getUTCDay() === 5;
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return weeklyOffDaysJson.some((value) => typeof value === 'string' && value === dayName);
}

function isHoliday(date: Date, branchId: string, holidays: HolidayRecord[]) {
  return holidays.some((holiday) => {
    if (holiday.branchId && holiday.branchId !== branchId) return false;
    return date >= holiday.startDate && date <= holiday.endDate;
  });
}

function buildDateRange(from: Date, to: Date) {
  const dates: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function isPresentLike(status: DerivedAttendanceStatus) {
  return ['PRESENT', 'LATE', 'EARLY_EXIT', 'LATE_EARLY', 'HALF_DAY', 'OFFICIAL_DUTY'].includes(status);
}

function matchesEmployeeFilters(employee: EmployeeRecord, filters: AttendanceReportFilters) {
  if (filters.branchId && employee.branchId !== filters.branchId) return false;
  if (filters.department && employee.department !== filters.department) return false;
  if (filters.designation && employee.designation !== filters.designation) return false;
  if (filters.shiftId && employee.shiftId !== filters.shiftId) return false;
  if (filters.employeeId && employee.id !== filters.employeeId) return false;
  if (filters.employmentType && employee.employmentType !== filters.employmentType) return false;
  return ['ACTIVE', 'ON_LEAVE'].includes(employee.status);
}

function deriveDailyEntry(args: {
  employee: EmployeeRecord;
  date: Date;
  attendance: AttendanceRecordWithEmployee | null;
  onLeave: boolean;
  holiday: boolean;
  recordedOtMinutes: number;
}) {
  const { employee, date, attendance, onLeave, holiday, recordedOtMinutes } = args;
  const shift = employee.shift;
  const weekend = isWeeklyOff(date, shift?.weeklyOffDays);
  const workingDay = !holiday && !weekend;

  const scheduledStart = shiftTimeToMinutes(shift?.startTime);
  const scheduledEnd = shiftTimeToMinutes(shift?.endTime);
  const breakDuration = breakMinutes(shift);

  const checkInMin = dateToMinutes(attendance?.checkIn);
  const checkOutMin = dateToMinutes(attendance?.checkOut);

  let lateMinutes = 0;
  if (attendance?.checkIn && shift) {
    const gracedStart = scheduledStart + (shift.lateGraceMinutes ?? 0);
    if (checkInMin > gracedStart) {
      lateMinutes = checkInMin - scheduledStart;
    }
  }

  let earlyMinutes = 0;
  if (attendance?.checkOut && shift) {
    const gracedEnd = scheduledEnd - (shift.earlyExitGraceMinutes ?? 0);
    if (checkOutMin < gracedEnd) {
      earlyMinutes = scheduledEnd - checkOutMin;
    }
  }

  let workingMinutes = 0;
  if (attendance?.checkIn && attendance?.checkOut) {
    workingMinutes = Math.max(0, Math.round((attendance.checkOut.getTime() - attendance.checkIn.getTime()) / 60000) - breakDuration);
  }

  let calculatedOtMinutes = 0;
  if (shift?.overtimeAllowed && attendance?.checkIn && attendance?.checkOut) {
    const scheduledMinutes = Math.max(0, scheduledEnd - scheduledStart - breakDuration);
    if (workingMinutes > scheduledMinutes && workingMinutes - scheduledMinutes >= (shift.minOtMinutes ?? 0)) {
      calculatedOtMinutes = Math.min(workingMinutes - scheduledMinutes, shift.maxOtMinutesPerDay || 9999);
    }
  }

  let status: DerivedAttendanceStatus = 'MISSING';
  if (attendance) {
    if (attendance.status === 'ABSENT') status = 'ABSENT';
    else if (attendance.status === 'ON_LEAVE') status = 'ON_LEAVE';
    else if (attendance.status === 'HOLIDAY') status = 'HOLIDAY';
    else if (attendance.status === 'WEEKEND') status = 'WEEKEND';
    else if (attendance.status === 'OFFICIAL_DUTY') status = 'OFFICIAL_DUTY';
    else if (attendance.status === 'HALF_DAY') status = 'HALF_DAY';
    else if (lateMinutes > 0 && earlyMinutes > 0) status = 'LATE_EARLY';
    else if (lateMinutes > 0) status = 'LATE';
    else if (earlyMinutes > 0) status = 'EARLY_EXIT';
    else status = 'PRESENT';
  } else if (holiday) {
    status = 'HOLIDAY';
  } else if (weekend) {
    status = 'WEEKEND';
  } else if (onLeave) {
    status = 'ON_LEAVE';
  }

  return {
    key: `${employee.id}-${dateKey(date)}`,
    date: dateKey(date),
    employeeId: employee.id,
    employeeCode: employee.code,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    branchId: employee.branchId,
    branchName: employee.branch.name,
    department: employee.department ?? '—',
    designation: employee.designation ?? '—',
    shiftId: employee.shiftId ?? '',
    shiftName: shift?.name ?? 'Unassigned',
    shiftStart: shift?.startTime ?? '—',
    shiftEnd: shift?.endTime ?? '—',
    employmentType: employee.employmentType ?? '—',
    checkIn: attendance?.checkIn ?? null,
    checkOut: attendance?.checkOut ?? null,
    workingMinutes,
    lateMinutes,
    earlyMinutes,
    calculatedOtMinutes,
    recordedOtMinutes,
    status,
    remarks: attendance?.remarks ?? '',
    isWorkingDay: workingDay,
  } satisfies DailyEntry;
}

function shouldApplyAttendanceStatusFilter(reportType: AttendanceReportType) {
  return [
    'DAILY_ATTENDANCE',
    'LATE_ARRIVAL',
    'EARLY_EXIT',
    'MISSING_ATTENDANCE',
    'ABSENT',
    'ATTENDANCE_ADJUSTMENT',
  ].includes(reportType);
}

function buildReportRows(args: {
  reportType: AttendanceReportType;
  dailyEntries: DailyEntry[];
  overtimeRecords: OvertimeRecordWithRelations[];
  adjustmentRecords: AdjustmentRecordWithRelations[];
  attendanceStatus: string;
}) {
  const { reportType, overtimeRecords, adjustmentRecords, attendanceStatus } = args;
  let entries = args.dailyEntries;

  if (attendanceStatus && shouldApplyAttendanceStatusFilter(reportType)) {
    entries = entries.filter((entry) => entry.status === attendanceStatus);
  }

  switch (reportType) {
    case 'DAILY_ATTENDANCE':
      return {
        title: 'Daily Attendance Report',
        description: 'Employee-wise daily attendance based on actual attendance logs and derived leave, holiday, and weekend states.',
        columns: ['Date', 'Employee ID', 'Employee', 'Department', 'Shift', 'Check-In', 'Check-Out', 'Working Hours', 'Status'],
        rows: entries
          .filter((entry) => entry.status !== 'MISSING')
          .map((entry) => [
            entry.date,
            entry.employeeCode,
            entry.employeeName,
            entry.department,
            entry.shiftName,
            formatTime(entry.checkIn),
            formatTime(entry.checkOut),
            minutesToHHMM(entry.workingMinutes),
            entry.status,
          ]),
      };
    case 'MONTHLY_ATTENDANCE': {
      const grouped = new Map<string, {
        employeeName: string;
        workingDays: number;
        present: number;
        absent: number;
        late: number;
        leave: number;
        overtimeMinutes: number;
        attendancePoints: number;
      }>();

      for (const entry of args.dailyEntries) {
        const current = grouped.get(entry.employeeId) ?? {
          employeeName: entry.employeeName,
          workingDays: 0,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          overtimeMinutes: 0,
          attendancePoints: 0,
        };
        if (entry.isWorkingDay) current.workingDays += 1;
        if (isPresentLike(entry.status)) {
          current.present += 1;
          current.attendancePoints += entry.status === 'HALF_DAY' ? 0.5 : 1;
        }
        if (entry.status === 'ABSENT') current.absent += 1;
        if (entry.status === 'ON_LEAVE') current.leave += 1;
        if (entry.status === 'LATE' || entry.status === 'LATE_EARLY') current.late += 1;
        current.overtimeMinutes += entry.recordedOtMinutes || entry.calculatedOtMinutes;
        grouped.set(entry.employeeId, current);
      }

      return {
        title: 'Monthly Attendance Report',
        description: 'Employee-wise attendance totals for the selected date range.',
        columns: ['Employee', 'Working Days', 'Present', 'Absent', 'Late', 'Leave', 'OT Hours', 'Attendance %'],
        rows: Array.from(grouped.values())
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
          .map((row) => [
            row.employeeName,
            row.workingDays,
            row.present,
            row.absent,
            row.late,
            row.leave,
            minutesToHHMM(row.overtimeMinutes),
            row.workingDays > 0 ? formatPercent((row.attendancePoints / row.workingDays) * 100) : '0.0%',
          ]),
      };
    }
    case 'ATTENDANCE_SUMMARY': {
      const grouped = new Map<string, { present: number; absent: number; leave: number; late: number }>();
      for (const entry of args.dailyEntries.filter((item) => item.isWorkingDay)) {
        const current = grouped.get(entry.department) ?? { present: 0, absent: 0, leave: 0, late: 0 };
        if (isPresentLike(entry.status)) current.present += 1;
        if (entry.status === 'ABSENT') current.absent += 1;
        if (entry.status === 'ON_LEAVE') current.leave += 1;
        if (entry.status === 'LATE' || entry.status === 'LATE_EARLY') current.late += 1;
        grouped.set(entry.department, current);
      }

      return {
        title: 'Attendance Summary Report',
        description: 'Department-wise attendance totals over the selected period.',
        columns: ['Department', 'Present', 'Absent', 'Leave', 'Late'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([department, row]) => [department, row.present, row.absent, row.leave, row.late]),
      };
    }
    case 'LATE_ARRIVAL':
      return {
        title: 'Late Arrival Report',
        description: 'Attendance rows where check-in exceeded the configured shift grace.',
        columns: ['Date', 'Employee ID', 'Employee', 'Department', 'Shift', 'Scheduled In', 'Check-In', 'Late Minutes', 'Status'],
        rows: entries
          .filter((entry) => entry.lateMinutes > 0)
          .map((entry) => [
            entry.date,
            entry.employeeCode,
            entry.employeeName,
            entry.department,
            entry.shiftName,
            entry.shiftStart,
            formatTime(entry.checkIn),
            entry.lateMinutes,
            entry.status,
          ]),
      };
    case 'EARLY_EXIT':
      return {
        title: 'Early Exit Report',
        description: 'Attendance rows where check-out happened before the allowed shift end.',
        columns: ['Date', 'Employee ID', 'Employee', 'Department', 'Shift', 'Scheduled Out', 'Check-Out', 'Early Minutes', 'Status'],
        rows: entries
          .filter((entry) => entry.earlyMinutes > 0)
          .map((entry) => [
            entry.date,
            entry.employeeCode,
            entry.employeeName,
            entry.department,
            entry.shiftName,
            entry.shiftEnd,
            formatTime(entry.checkOut),
            entry.earlyMinutes,
            entry.status,
          ]),
      };
    case 'OVERTIME':
      return {
        title: 'Overtime Report',
        description: 'Overtime records created from attendance or manual HR processing.',
        columns: ['Date', 'Employee ID', 'Employee', 'Department', 'Shift', 'OT Type', 'Approved OT Hours', 'Amount', 'Status'],
        rows: overtimeRecords.map((record) => [
          formatDate(record.otDate),
          record.employee.code,
          `${record.employee.firstName} ${record.employee.lastName}`,
          record.employee.department ?? '—',
          record.shift?.name ?? record.employee.shift?.name ?? 'Unassigned',
          record.otType,
          minutesToHHMM(record.approvedOtMinutes),
          Number(record.otAmount).toFixed(2),
          record.status,
        ]),
      };
    case 'MISSING_ATTENDANCE':
      return {
        title: 'Missing Attendance Report',
        description: 'Working days where no attendance record or approved leave was found.',
        columns: ['Date', 'Employee ID', 'Employee', 'Department', 'Shift', 'Employment Type', 'Status'],
        rows: entries
          .filter((entry) => entry.status === 'MISSING')
          .map((entry) => [
            entry.date,
            entry.employeeCode,
            entry.employeeName,
            entry.department,
            entry.shiftName,
            entry.employmentType,
            entry.status,
          ]),
      };
    case 'ABSENT':
      return {
        title: 'Absent Report',
        description: 'Attendance rows explicitly marked absent.',
        columns: ['Date', 'Employee ID', 'Employee', 'Department', 'Shift', 'Status', 'Remarks'],
        rows: entries
          .filter((entry) => entry.status === 'ABSENT')
          .map((entry) => [
            entry.date,
            entry.employeeCode,
            entry.employeeName,
            entry.department,
            entry.shiftName,
            entry.status,
            entry.remarks || '—',
          ]),
      };
    case 'SHIFT_ATTENDANCE': {
      const grouped = new Map<string, { present: number; absent: number; leave: number; late: number; employees: Set<string> }>();
      for (const entry of args.dailyEntries.filter((item) => item.isWorkingDay)) {
        const current = grouped.get(entry.shiftName) ?? { present: 0, absent: 0, leave: 0, late: 0, employees: new Set<string>() };
        if (isPresentLike(entry.status)) current.present += 1;
        if (entry.status === 'ABSENT') current.absent += 1;
        if (entry.status === 'ON_LEAVE') current.leave += 1;
        if (entry.status === 'LATE' || entry.status === 'LATE_EARLY') current.late += 1;
        current.employees.add(entry.employeeId);
        grouped.set(entry.shiftName, current);
      }

      return {
        title: 'Shift Attendance Report',
        description: 'Shift-wise attendance totals across the selected date range.',
        columns: ['Shift', 'Present', 'Absent', 'Leave', 'Late', 'Employees'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([shiftName, row]) => [shiftName, row.present, row.absent, row.leave, row.late, row.employees.size]),
      };
    }
    case 'ATTENDANCE_ADJUSTMENT':
    default:
      return {
        title: 'Attendance Adjustment Report',
        description: 'Attendance correction records created in the Attendance Adjustment module.',
        columns: ['Adjustment No', 'Date', 'Employee', 'Type', 'Old Status', 'New Status', 'Old Shift', 'New Shift', 'Status'],
        rows: adjustmentRecords
          .filter((record) => !attendanceStatus || record.newStatus === attendanceStatus || record.oldStatus === attendanceStatus)
          .map((record) => [
            record.adjustmentNumber,
            formatDate(record.attendanceDate),
            `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
            record.adjustmentType,
            record.oldStatus,
            record.newStatus,
            record.oldShift?.name ?? record.employee.shift?.name ?? '—',
            record.newShift?.name ?? '—',
            record.status,
          ]),
      };
  }
}

export const attendanceReportsService = {
  async getReportCenter(session: AppSession | null, filters: AttendanceReportFilters = {}) {
    await authorize(session, 'hr:read');

    const reportType = filters.reportType ?? 'DAILY_ATTENDANCE';
    const dateFrom = filters.dateFrom || currentMonthStartString();
    const dateTo = filters.dateTo || todayDateString();
    const from = normalizeDateStart(dateFrom) ?? normalizeDateStart(currentMonthStartString())!;
    const to = normalizeDateEnd(dateTo) ?? normalizeDateEnd(todayDateString())!;

    const [branches, shifts, allEmployees] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.shift.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          shift: {
            select: {
              id: true,
              code: true,
              name: true,
              startTime: true,
              endTime: true,
              breakStart: true,
              breakEnd: true,
              weeklyOffDays: true,
              lateGraceMinutes: true,
              earlyExitGraceMinutes: true,
              overtimeAllowed: true,
              minOtMinutes: true,
              maxOtMinutesPerDay: true,
            },
          },
        },
        orderBy: [{ code: 'asc' }],
      }),
    ]);

    const filteredEmployees = allEmployees.filter((employee) => matchesEmployeeFilters(employee, filters));
    const employeeIds = filteredEmployees.map((employee) => employee.id);

    const emptyReport = buildReportRows({
      reportType,
      dailyEntries: [],
      overtimeRecords: [],
      adjustmentRecords: [],
      attendanceStatus: filters.attendanceStatus ?? '',
    });

    if (employeeIds.length === 0) {
      return {
        filters: {
          reportType,
          branchId: filters.branchId ?? '',
          department: filters.department ?? '',
          designation: filters.designation ?? '',
          shiftId: filters.shiftId ?? '',
          employeeId: filters.employeeId ?? '',
          employmentType: filters.employmentType ?? '',
          attendanceStatus: filters.attendanceStatus ?? '',
          dateFrom,
          dateTo,
        },
        options: {
          branches,
          departments: Array.from(new Set(allEmployees.map((employee) => employee.department).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
          designations: Array.from(new Set(allEmployees.map((employee) => employee.designation).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
          shifts: shifts.map((shift) => ({ value: shift.id, label: `${shift.code} · ${shift.name}` })),
          employees: allEmployees.map((employee) => ({ value: employee.id, label: `${employee.code} · ${employee.firstName} ${employee.lastName}` })),
          employmentTypes: Array.from(new Set(allEmployees.map((employee) => employee.employmentType).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
          attendanceStatuses: ['PRESENT', 'ABSENT', 'LATE', 'EARLY_EXIT', 'LATE_EARLY', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'OFFICIAL_DUTY', 'MISSING'],
        },
        dashboard: {
          presentToday: 0,
          absentToday: 0,
          lateToday: 0,
          onLeaveToday: 0,
          overtimeEmployees: 0,
          attendanceRate: '0.0%',
        },
        report: emptyReport,
        meta: { rowCount: 0 },
      };
    }

    const todayStart = normalizeDateStart(todayDateString())!;
    const todayEnd = normalizeDateEnd(todayDateString())!;

    const [attendanceRecords, leaveRequests, holidays, overtimeRecords, adjustmentRecords, todaysAttendance, todaysLeaves, todaysHolidays, todaysOvertime] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: from, lte: to },
        },
        include: {
          employee: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
              shift: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                  breakStart: true,
                  breakEnd: true,
                  weeklyOffDays: true,
                  lateGraceMinutes: true,
                  earlyExitGraceMinutes: true,
                  overtimeAllowed: true,
                  minOtMinutes: true,
                  maxOtMinutesPerDay: true,
                },
              },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { employee: { code: 'asc' } }],
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          fromDate: { lte: to },
          toDate: { gte: from },
        },
        select: { id: true, employeeId: true, fromDate: true, toDate: true, status: true },
      }),
      prisma.holiday.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: to },
          endDate: { gte: from },
          OR: [{ branchId: null }, { branchId: { in: Array.from(new Set(filteredEmployees.map((employee) => employee.branchId))) } }],
        },
        select: { id: true, name: true, branchId: true, startDate: true, endDate: true, status: true },
      }),
      prisma.overtimeRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          otDate: { gte: from, lte: to },
          status: { notIn: ['CANCELLED', 'REJECTED'] },
        },
        include: {
          employee: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
              shift: { select: { id: true, code: true, name: true } },
            },
          },
          branch: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ otDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.attendanceAdjustment.findMany({
        where: {
          employeeId: { in: employeeIds },
          attendanceDate: { gte: from, lte: to },
        },
        include: {
          employee: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
              shift: { select: { id: true, code: true, name: true } },
            },
          },
          oldShift: { select: { id: true, code: true, name: true } },
          newShift: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: todayStart, lte: todayEnd },
        },
        include: {
          employee: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
              shift: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                  breakStart: true,
                  breakEnd: true,
                  weeklyOffDays: true,
                  lateGraceMinutes: true,
                  earlyExitGraceMinutes: true,
                  overtimeAllowed: true,
                  minOtMinutes: true,
                  maxOtMinutesPerDay: true,
                },
              },
            },
          },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          fromDate: { lte: todayEnd },
          toDate: { gte: todayStart },
        },
        select: { id: true, employeeId: true, fromDate: true, toDate: true, status: true },
      }),
      prisma.holiday.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
          OR: [{ branchId: null }, { branchId: { in: Array.from(new Set(filteredEmployees.map((employee) => employee.branchId))) } }],
        },
        select: { id: true, name: true, branchId: true, startDate: true, endDate: true, status: true },
      }),
      prisma.overtimeRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          otDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CANCELLED', 'REJECTED'] },
        },
        include: {
          employee: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
              shift: { select: { id: true, code: true, name: true } },
            },
          },
          branch: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    const attendanceByKey = new Map(attendanceRecords.map((record) => [`${record.employeeId}-${dateKey(record.date)}`, record]));
    const todaysAttendanceByKey = new Map(todaysAttendance.map((record) => [`${record.employeeId}-${dateKey(record.date)}`, record]));

    const leaveByEmployee = new Map<string, Set<string>>();
    for (const leave of leaveRequests) {
      const overlapStart = leave.fromDate > from ? leave.fromDate : from;
      const overlapEnd = leave.toDate < to ? leave.toDate : to;
      const dates = buildDateRange(overlapStart, overlapEnd);
      const set = leaveByEmployee.get(leave.employeeId) ?? new Set<string>();
      for (const day of dates) set.add(dateKey(day));
      leaveByEmployee.set(leave.employeeId, set);
    }

    const todaysLeaveByEmployee = new Map<string, Set<string>>();
    for (const leave of todaysLeaves) {
      const overlapStart = leave.fromDate > todayStart ? leave.fromDate : todayStart;
      const overlapEnd = leave.toDate < todayEnd ? leave.toDate : todayEnd;
      const dates = buildDateRange(overlapStart, overlapEnd);
      const set = todaysLeaveByEmployee.get(leave.employeeId) ?? new Set<string>();
      for (const day of dates) set.add(dateKey(day));
      todaysLeaveByEmployee.set(leave.employeeId, set);
    }

    const recordedOtByKey = new Map<string, number>();
    for (const record of overtimeRecords) {
      const key = `${record.employeeId}-${dateKey(record.otDate)}`;
      recordedOtByKey.set(key, (recordedOtByKey.get(key) ?? 0) + record.approvedOtMinutes);
    }

    const todaysRecordedOtByKey = new Map<string, number>();
    for (const record of todaysOvertime) {
      const key = `${record.employeeId}-${dateKey(record.otDate)}`;
      todaysRecordedOtByKey.set(key, (todaysRecordedOtByKey.get(key) ?? 0) + record.approvedOtMinutes);
    }

    const rangeDates = buildDateRange(from, to);
    const dailyEntries: DailyEntry[] = [];
    for (const employee of filteredEmployees) {
      const leaveDates = leaveByEmployee.get(employee.id) ?? new Set<string>();
      for (const day of rangeDates) {
        dailyEntries.push(
          deriveDailyEntry({
            employee,
            date: day,
            attendance: attendanceByKey.get(`${employee.id}-${dateKey(day)}`) ?? null,
            onLeave: leaveDates.has(dateKey(day)),
            holiday: isHoliday(day, employee.branchId, holidays),
            recordedOtMinutes: recordedOtByKey.get(`${employee.id}-${dateKey(day)}`) ?? 0,
          }),
        );
      }
    }

    const todayEntries: DailyEntry[] = filteredEmployees.map((employee) =>
      deriveDailyEntry({
        employee,
        date: todayStart,
        attendance: todaysAttendanceByKey.get(`${employee.id}-${todayDateString()}`) ?? null,
        onLeave: (todaysLeaveByEmployee.get(employee.id) ?? new Set<string>()).has(todayDateString()),
        holiday: isHoliday(todayStart, employee.branchId, todaysHolidays),
        recordedOtMinutes: todaysRecordedOtByKey.get(`${employee.id}-${todayDateString()}`) ?? 0,
      }),
    );

    const presentToday = todayEntries.filter((entry) => isPresentLike(entry.status)).length;
    const absentToday = todayEntries.filter((entry) => entry.status === 'ABSENT').length;
    const lateToday = todayEntries.filter((entry) => entry.status === 'LATE' || entry.status === 'LATE_EARLY').length;
    const onLeaveToday = todayEntries.filter((entry) => entry.status === 'ON_LEAVE').length;
    const overtimeEmployees = new Set(
      todayEntries
        .filter((entry) => (entry.recordedOtMinutes || entry.calculatedOtMinutes) > 0)
        .map((entry) => entry.employeeId),
    ).size;
    const attendanceRateBase = filteredEmployees.length > 0 ? (presentToday / filteredEmployees.length) * 100 : 0;

    const report = buildReportRows({
      reportType,
      dailyEntries,
      overtimeRecords,
      adjustmentRecords,
      attendanceStatus: filters.attendanceStatus ?? '',
    });

    return {
      filters: {
        reportType,
        branchId: filters.branchId ?? '',
        department: filters.department ?? '',
        designation: filters.designation ?? '',
        shiftId: filters.shiftId ?? '',
        employeeId: filters.employeeId ?? '',
        employmentType: filters.employmentType ?? '',
        attendanceStatus: filters.attendanceStatus ?? '',
        dateFrom,
        dateTo,
      },
      options: {
        branches,
        departments: Array.from(new Set(allEmployees.map((employee) => employee.department).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        designations: Array.from(new Set(allEmployees.map((employee) => employee.designation).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        shifts: shifts.map((shift) => ({ value: shift.id, label: `${shift.code} · ${shift.name}` })),
        employees: allEmployees.map((employee) => ({ value: employee.id, label: `${employee.code} · ${employee.firstName} ${employee.lastName}` })),
        employmentTypes: Array.from(new Set(allEmployees.map((employee) => employee.employmentType).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        attendanceStatuses: ['PRESENT', 'ABSENT', 'LATE', 'EARLY_EXIT', 'LATE_EARLY', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'OFFICIAL_DUTY', 'MISSING'],
      },
      dashboard: {
        presentToday,
        absentToday,
        lateToday,
        onLeaveToday,
        overtimeEmployees,
        attendanceRate: formatPercent(attendanceRateBase),
      },
      report,
      meta: {
        rowCount: report.rows.length,
      },
    };
  },
};
