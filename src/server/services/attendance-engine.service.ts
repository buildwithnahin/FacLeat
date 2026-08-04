import { prisma } from '@/server/db';
import { differenceInMinutes, parse, format, isAfter, isBefore, addMinutes, subMinutes, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { AttendanceStatus, MissingPunchType } from '@/generated/prisma';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';

export const attendanceEngineService = {
  /**
   * Main processor for a single employee's daily attendance logic.
   */
  async processEmployeeDay(
    session: AppSession | null,
    employeeId: string,
    date: Date,
    actualCheckIn: Date | null,
    actualCheckOut: Date | null,
  ) {
    await authorize(session, 'hr:attendance');
    // 1. Find the employee and their shift (defaulting to a global shift or the one assigned)
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        shift: true,
      }
    });

    if (!employee) throw new Error("Employee not found");

    // 2. Get Rules (Either specific shift rules or fallback to global rule)
    const rule = await prisma.attendanceRule.findFirst({
      where: { OR: [{ shiftId: employee.shiftId }, { branchId: employee.branchId }] },
      orderBy: { createdAt: 'desc' }
    });

    const shift = employee.shift;
    if (!shift) return; // Cannot process without a shift

    // Set base shift times on the specific date
    let expectedIn = this.timeStringToDate(date, shift.startTime);
    let expectedOut = this.timeStringToDate(date, shift.endTime);
    
    // Handle overnight shifts
    if (isBefore(expectedOut, expectedIn)) {
      expectedOut = addMinutes(expectedOut, 24 * 60);
    }

    const graceLate = rule?.graceLateEntryMinutes ?? shift.lateGraceMinutes ?? 0;
    const graceEarly = rule?.graceEarlyExitMinutes ?? shift.earlyExitGraceMinutes ?? 0;
    const otStartAfter = rule?.overtimeStartAfterMinutes ?? parseInt(shift.otStartsAfter || '0') ?? 0;

    let lateMinutes = 0;
    let earlyExitMinutes = 0;
    let workingMinutes = 0;
    let overtimeMinutes = 0;
    let isMissingPunch = false;
    let isLateEntry = false;
    let isEarlyExit = false;

    const exceptions = [];

    // --- 3. Missing Punch Check ---
    if (!actualCheckIn && actualCheckOut) {
      isMissingPunch = true;
      exceptions.push({ type: 'MISSING_PUNCH', missingType: 'MISSING_IN' });
    } else if (actualCheckIn && !actualCheckOut) {
      isMissingPunch = true;
      exceptions.push({ type: 'MISSING_PUNCH', missingType: 'MISSING_OUT' });
    } else if (!actualCheckIn && !actualCheckOut) {
      // Absent scenario, not technically a missing punch unless they were expected
      isMissingPunch = true;
      exceptions.push({ type: 'MISSING_PUNCH', missingType: 'BOTH_MISSING' });
    }

    if (actualCheckIn && actualCheckOut) {
      workingMinutes = differenceInMinutes(actualCheckOut, actualCheckIn);

      // --- 4. Late Entry Check ---
      const allowedInTime = addMinutes(expectedIn, graceLate);
      if (isAfter(actualCheckIn, allowedInTime)) {
        isLateEntry = true;
        lateMinutes = differenceInMinutes(actualCheckIn, expectedIn);
        exceptions.push({ type: 'LATE_ENTRY', actualTime: actualCheckIn, expectedTime: expectedIn, diffMinutes: lateMinutes });
      }

      // --- 5. Early Exit Check ---
      const allowedOutTime = subMinutes(expectedOut, graceEarly);
      if (isBefore(actualCheckOut, allowedOutTime)) {
        isEarlyExit = true;
        earlyExitMinutes = differenceInMinutes(expectedOut, actualCheckOut);
        exceptions.push({ type: 'EARLY_EXIT', actualTime: actualCheckOut, expectedTime: expectedOut, diffMinutes: earlyExitMinutes });
      }

      // --- 6. Overtime Check ---
      const shiftWorkingMinutes = differenceInMinutes(expectedOut, expectedIn);
      const extraMinutes = workingMinutes - shiftWorkingMinutes;
      
      if ((shift.overtimeAllowed || rule?.autoApproveOvertime) && extraMinutes > otStartAfter) {
        overtimeMinutes = extraMinutes;
      }
    }

    // Determine status
    let status = AttendanceStatus.ABSENT;
    if (actualCheckIn && actualCheckOut) {
      const minPresentMin = shift.minPresentMinutes;
      const minHalfMin = shift.minHalfDayMinutes;
      
      if (workingMinutes >= minPresentMin) {
        status = AttendanceStatus.PRESENT;
      } else if (workingMinutes >= minHalfMin) {
        status = AttendanceStatus.HALF_DAY;
      } else {
        status = AttendanceStatus.ABSENT;
      }
    }

    // --- 7. Save to DB ---
    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId, date, checkIn: actualCheckIn, checkOut: actualCheckOut,
        status, lateMinutes, earlyExitMinutes, workingMinutes, overtimeMinutes,
        isMissingPunch, isLateEntry, isEarlyExit
      },
      update: {
        checkIn: actualCheckIn, checkOut: actualCheckOut,
        status, lateMinutes, earlyExitMinutes, workingMinutes, overtimeMinutes,
        isMissingPunch, isLateEntry, isEarlyExit
      }
    });

    // Create exceptions for workflow approval
    for (const ex of exceptions) {
      await prisma.attendanceException.create({
        data: {
          employeeId,
          date,
          type: ex.type,
          missingType: (ex.missingType as MissingPunchType) || null,
          actualTime: ex.actualTime,
          expectedTime: ex.expectedTime,
          diffMinutes: ex.diffMinutes || 0,
        }
      });
    }

    return record;
  },

  timeStringToDate(baseDate: Date, timeStr: string) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return setMilliseconds(setSeconds(setMinutes(setHours(baseDate, hours), minutes), 0), 0);
  }
};
