import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { AttendanceSummaryGenerateInput, AttendanceSummaryActionInput, AttendanceSummaryBulkActionInput } from '@/server/validators/attendance-summary';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const SUMMARY_INCLUDE = {
  branch: { select: { id: true, code: true, name: true } },
  employee: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      department: true,
      designation: true,
      branchId: true,
    },
  },
} as const;

function getMonthBounds(summaryMonth: string) {
  const [yearStr, monthStr] = summaryMonth.split('-');
  const year = parseInt(yearStr ?? '', 10);
  const month = parseInt(monthStr ?? '', 10);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const totalCalendarDays = end.getUTCDate();
  return { start, end, totalCalendarDays, year, month };
}

// Helper to determine if a date is a weekly off day based on shift config
function isWeeklyOff(date: Date, weeklyOffDaysJson: Prisma.JsonValue | null): boolean {
  if (!weeklyOffDaysJson) return date.getUTCDay() === 5; // Default Friday
  try {
    const days = weeklyOffDaysJson as string[];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    return days.includes(dayName);
  } catch {
    return date.getUTCDay() === 5;
  }
}

export const attendanceSummaryService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; summaryMonth?: string; status?: string; employeeId?: string; q?: string } = {}
  ) {
    await authorize(session, 'hr:read');
    return prisma.attendanceSummaryRecord.findMany({
      where: {
        branchId: filters.branchId || undefined,
        summaryMonth: filters.summaryMonth || undefined,
        status: filters.status as never || undefined,
        employeeId: filters.employeeId || undefined,
        OR: filters.q
          ? [
              { employee: { firstName: { contains: filters.q } } },
              { employee: { lastName: { contains: filters.q } } },
              { employee: { code: { contains: filters.q } } },
            ]
          : undefined,
      },
      include: SUMMARY_INCLUDE,
      orderBy: [{ employee: { code: 'asc' } }],
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const record = await prisma.attendanceSummaryRecord.findUnique({
      where: { id },
      include: SUMMARY_INCLUDE,
    });
    if (!record) throw new NotFoundError('Summary record not found');
    return record;
  },

  async generateOrRecalculate(session: AppSession | null, input: AttendanceSummaryGenerateInput) {
    const actor = await authorize(session, 'hr:write');
    const { start, end, totalCalendarDays } = getMonthBounds(input.summaryMonth);

    // Get active employees for criteria
    const employees = await prisma.employee.findMany({
      where: {
        branchId: input.branchId,
        status: 'ACTIVE',
        department: input.department || undefined,
        shiftId: input.shiftId || undefined,
        id: input.employeeId || undefined,
      },
      include: { shift: true },
    });

    if (employees.length === 0) return { generatedCount: 0 };

    // Fetch related data in bulk for the month
    const empIds = employees.map(e => e.id);
    const [attendanceRecords, leaveRequests, holidays, overtimes] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId: { in: empIds }, date: { gte: start, lte: end } },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId: { in: empIds }, status: 'APPROVED', fromDate: { lte: end }, toDate: { gte: start } },
      }),
      prisma.holiday.findMany({
        where: { status: 'ACTIVE', startDate: { lte: end }, endDate: { gte: start }, OR: [{ branchId: input.branchId }, { branchId: null }] },
      }),
      prisma.overtimeRecord.findMany({
        where: { employeeId: { in: empIds }, otMonth: input.summaryMonth, status: { in: ['APPROVED', 'POSTED_TO_PAYROLL'] } },
      }),
    ]);

    const attByEmp = new Map<string, typeof attendanceRecords>();
    const leaveByEmp = new Map<string, typeof leaveRequests>();
    const otByEmp = new Map<string, typeof overtimes>();

    for (const id of empIds) {
      attByEmp.set(id, attendanceRecords.filter(a => a.employeeId === id));
      leaveByEmp.set(id, leaveRequests.filter(l => l.employeeId === id));
      otByEmp.set(id, overtimes.filter(o => o.employeeId === id));
    }

    let generatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const emp of employees) {
        // Prevent recalculating locked or sent records
        const existing = await tx.attendanceSummaryRecord.findUnique({
          where: { employeeId_summaryMonth: { employeeId: emp.id, summaryMonth: input.summaryMonth } },
        });
        if (existing && (existing.isLocked || existing.sentToPayroll)) {
          continue; 
        }

        const atts = attByEmp.get(emp.id) || [];
        const leaves = leaveByEmp.get(emp.id) || [];
        const ots = otByEmp.get(emp.id) || [];

        let weeklyOffDays = 0;
        let holidayDays = 0;
        let leaveDays = 0;
        let presentDays = 0;
        let lateDays = 0;
        let earlyExitDays = 0;
        let halfDays = 0;
        let totalWorkedMinutes = 0;
        
        // Detailed day-by-day iteration
        for (let d = 1; d <= totalCalendarDays; d++) {
          const currentDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), d));
          
          // Check Holidays
          const isHoliday = holidays.some(h => currentDate >= h.startDate && currentDate <= h.endDate);
          if (isHoliday) {
            holidayDays++;
            continue; // Skip counting as leave/absent/working if it's a holiday
          }

          // Check Weekly Off
          if (isWeeklyOff(currentDate, emp.shift?.weeklyOffDays ?? null)) {
            weeklyOffDays++;
            continue;
          }

          // Check Leave
          const isLeave = leaves.some(l => currentDate >= l.fromDate && currentDate <= l.toDate);
          if (isLeave) {
            leaveDays++;
            continue;
          }

          // Check Attendance (Working Day)
          const att = atts.find(a => a.date.toISOString().slice(0, 10) === currentDate.toISOString().slice(0, 10));
          if (att) {
            if (['PRESENT', 'LATE', 'HALF_DAY', 'EARLY_EXIT', 'LATE_EARLY'].includes(att.status)) {
              presentDays++;
              if (att.status === 'HALF_DAY') halfDays++;
              if (att.checkIn && att.checkOut) {
                const diff = (att.checkOut.getTime() - att.checkIn.getTime()) / 60000;
                totalWorkedMinutes += Math.max(0, diff);
              }
            }
          }
        }

        // Aggregate Late and Early directly from attendance logs (these might be separate from the core PRESENT status in some systems)
        // Here we can simply count from the attendance records themselves for accuracy
        lateDays = atts.filter(a => ['LATE', 'LATE_EARLY'].includes(a.status)).length;
        earlyExitDays = atts.filter(a => ['EARLY_EXIT', 'LATE_EARLY'].includes(a.status)).length;

        // Final Working / Absent Days
        const workingDays = totalCalendarDays - weeklyOffDays - holidayDays;
        const absentDays = Math.max(0, workingDays - presentDays - leaveDays);

        // OT Hours
        const totalOtHours = ots.reduce((acc, ot) => acc + (ot.approvedOtMinutes / 60), 0);

        // Payable Days = Total Calendar Days - Unpaid Absences 
        // Assuming leaves are paid for this calculation, adjust based on your specific rules.
        const payableDays = totalCalendarDays - absentDays;

        const data = {
          branchId: input.branchId,
          totalCalendarDays,
          weeklyOffDays,
          holidayDays,
          workingDays,
          presentDays,
          absentDays,
          leaveDays,
          halfDays,
          lateDays,
          earlyExitDays,
          totalWorkedHours: D(totalWorkedMinutes / 60),
          totalOtHours: D(totalOtHours),
          payableDays: D(payableDays),
          status: 'GENERATED' as never,
          isPayrollReady: absentDays === 0 && lateDays === 0, // simple heuristic
          updatedById: actor.userId,
        };

        if (existing) {
          await tx.attendanceSummaryRecord.update({
            where: { id: existing.id },
            data,
          });
          generatedCount++;
        } else {
          await tx.attendanceSummaryRecord.create({
            data: {
              employeeId: emp.id,
              summaryMonth: input.summaryMonth,
              createdById: actor.userId,
              ...data,
            },
          });
          generatedCount++;
        }
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: input.branchId,
        module: 'hr',
        action: 'attendance-summary-generate',
        entityType: 'AttendanceSummaryRecord',
        entityId: input.summaryMonth,
        after: { generatedCount, summaryMonth: input.summaryMonth },
      }, tx);
    });

    return { generatedCount };
  },

  async handleSingleAction(session: AppSession | null, input: AttendanceSummaryActionInput) {
    const actor = await authorize(session, 'hr:write');
    const record = await prisma.attendanceSummaryRecord.findUnique({ where: { id: input.id } });
    if (!record) throw new NotFoundError('Summary record not found');

    return prisma.$transaction(async (tx) => {
      let data: any = {};
      let actionName = 'attendance-summary-action';

      switch (input.action) {
        case 'lock':
          data = { isLocked: true, status: 'LOCKED' };
          actionName = 'attendance-summary-lock';
          break;
        case 'unlock':
          data = { isLocked: false, status: 'UNDER_REVIEW' };
          actionName = 'attendance-summary-unlock';
          break;
        case 'send-payroll':
          if (!record.isLocked) throw new ValidationError('Cannot send to payroll unless locked');
          data = { sentToPayroll: true, status: 'SENT_TO_PAYROLL', sentById: actor.userId, sentAt: new Date() };
          actionName = 'attendance-summary-send-payroll';
          break;
        case 'require-adjustment':
          data = { status: 'ADJUSTMENT_REQUIRED' };
          break;
        case 'mark-ready':
          data = { status: 'READY_FOR_PAYROLL', isPayrollReady: true };
          break;
      }

      const updated = await tx.attendanceSummaryRecord.update({
        where: { id: input.id },
        data: { ...data, updatedById: actor.userId },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: record.branchId,
        module: 'hr',
        action: actionName,
        entityType: 'AttendanceSummaryRecord',
        entityId: record.id,
        before: { status: record.status },
        after: { status: updated.status },
      }, tx);

      return updated;
    });
  },
};
