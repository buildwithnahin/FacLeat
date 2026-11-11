import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  OvertimeGenerateInput,
  OvertimeCreateInput,
  OvertimeManagerApprovalInput,
  OvertimeHrVerificationInput,
  OvertimeAccountsApprovalInput,
} from '@/server/validators/overtime';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

const OT_INCLUDE = {
  branch: { select: { id: true, code: true, name: true } },
  employee: {
    select: {
      id: true, code: true, firstName: true, lastName: true,
      department: true, designation: true, branchId: true,
      basicSalary: true, houseAllowance: true, transportAllowance: true,
      medicalAllowance: true, otherAllowance: true,
    },
  },
  shift: {
    select: {
      id: true, name: true, code: true, startTime: true, endTime: true,
      breakStart: true, breakEnd: true, overtimeAllowed: true,
      otStartsAfter: true, minOtMinutes: true, maxOtMinutesPerDay: true,
    },
  },
} as const;

async function nextOtNumber(date: Date) {
  const year = date.getUTCFullYear();
  const prefix = `OT-${year}-`;
  const last = await prisma.overtimeRecord.findFirst({
    where: { otNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { otNumber: true },
  });
  const seq = last ? parseInt(last.otNumber.split('-').at(-1) ?? '0', 10) : 0;
  return `${prefix}${String(seq + 1).padStart(5, '0')}`;
}

export const overtimeService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; otMonth?: string; employeeId?: string; q?: string } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.overtimeRecord.findMany({
      where: {
        branchId: filters.branchId || undefined,
        status: filters.status as never || undefined,
        otMonth: filters.otMonth || undefined,
        employeeId: filters.employeeId || undefined,
        OR: filters.q
          ? [
              { otNumber: { contains: filters.q } },
              { employee: { firstName: { contains: filters.q } } },
              { employee: { lastName: { contains: filters.q } } },
              { employee: { code: { contains: filters.q } } },
            ]
          : undefined,
      },
      include: OT_INCLUDE,
      orderBy: [{ otDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const row = await prisma.overtimeRecord.findUnique({
      where: { id },
      include: OT_INCLUDE,
    });
    if (!row) throw new NotFoundError('Overtime record not found');
    return row;
  },

  // Generate OT records from attendance for a given date
  async generateFromAttendance(session: AppSession | null, input: OvertimeGenerateInput) {
    const actor = await authorize(session, 'hr:write');

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

    const attendance = await prisma.attendanceRecord.findMany({
      where: {
        date: input.date,
        employeeId: { in: employees.map((e) => e.id) },
      },
    });
    const attMap = new Map(attendance.map((a) => [a.employeeId, a]));
    const otMonth = input.date.toISOString().slice(0, 7);
    const created: string[] = [];

    // Check existing OT records for this date to avoid duplicates
    const existing = await prisma.overtimeRecord.findMany({
      where: {
        attendanceDate: input.date,
        employeeId: { in: employees.map((e) => e.id) },
        status: { notIn: ['CANCELLED', 'REJECTED'] },
      },
      select: { employeeId: true },
    });
    const existingSet = new Set(existing.map((e) => e.employeeId));

    for (const emp of employees) {
      if (existingSet.has(emp.id)) continue;
      const att = attMap.get(emp.id);
      if (!att?.checkIn || !att?.checkOut) continue;

      const shift = emp.shift;
      if (!shift) continue;

      const shiftStartMin = parseTime(shift.startTime);
      const shiftEndMin = parseTime(shift.endTime);
      let breakMin = 0;
      if (shift.breakStart && shift.breakEnd) {
        breakMin = Math.max(0, parseTime(shift.breakEnd) - parseTime(shift.breakStart));
      }

      const totalWorkedMinutes = minutesBetween(att.checkIn, att.checkOut);
      const regularDutyMinutes = shiftEndMin - shiftStartMin - breakMin;
      const extraWorkedMinutes = Math.max(0, totalWorkedMinutes - breakMin - regularDutyMinutes);

      // Check OT eligibility
      if (!shift.overtimeAllowed && !['HOLIDAY', 'WEEKEND'].includes(att.status)) continue;
      if (extraWorkedMinutes < (shift.minOtMinutes || 0) && !['HOLIDAY', 'WEEKEND'].includes(att.status)) continue;

      let eligibleOtMinutes = extraWorkedMinutes;
      if (['HOLIDAY', 'WEEKEND'].includes(att.status)) {
        eligibleOtMinutes = totalWorkedMinutes - breakMin;
      }
      if (shift.maxOtMinutesPerDay > 0) {
        eligibleOtMinutes = Math.min(eligibleOtMinutes, shift.maxOtMinutesPerDay);
      }

      if (eligibleOtMinutes <= 0) continue;

      // Calculate late/early
      const checkInMin = att.checkIn.getUTCHours() * 60 + att.checkIn.getUTCMinutes();
      const checkOutMin = att.checkOut.getUTCHours() * 60 + att.checkOut.getUTCMinutes();
      const lateMinutes = Math.max(0, checkInMin - shiftStartMin);
      const earlyExitMinutes = Math.max(0, shiftEndMin - checkOutMin);

      // Calculate OT rate & amount
      let otRatePerHour = Number(input.otRatePerHour || 0);
      if (input.otRateType === 'BASIC_SALARY_BASED') {
        const monthlySalary = Number(emp.basicSalary);
        otRatePerHour = monthlySalary / 26 / 8; // ~26 working days, 8 hrs/day
      } else if (input.otRateType === 'GROSS_SALARY_BASED') {
        const gross = Number(emp.basicSalary) + Number(emp.houseAllowance) +
          Number(emp.transportAllowance) + Number(emp.medicalAllowance) + Number(emp.otherAllowance);
        otRatePerHour = gross / 26 / 8;
      }
      const otAmount = (eligibleOtMinutes / 60) * otRatePerHour;

      const otNumber = await nextOtNumber(input.date);

      await prisma.$transaction(async (tx) => {
        const record = await tx.overtimeRecord.create({
          data: {
            otNumber,
            branchId: input.branchId,
            employeeId: emp.id,
            shiftId: emp.shiftId,
            otDate: input.date,
            otMonth,
            otType: input.otType,
            source: 'ATTENDANCE_BASED',
            status: 'DRAFT',
            attendanceDate: input.date,
            checkIn: att.checkIn,
            checkOut: att.checkOut,
            totalWorkedMinutes,
            regularDutyMinutes,
            breakMinutes: breakMin,
            extraWorkedMinutes,
            lateMinutes,
            earlyExitMinutes,
            eligibleOtMinutes,
            approvedOtMinutes: eligibleOtMinutes,
            otRateType: input.otRateType,
            otRatePerHour: D(otRatePerHour),
            otAmount: D(otAmount),
            minOtMinutes: shift.minOtMinutes,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
        });
        await recordAudit({
          actorId: actor.userId, branchId: input.branchId, module: 'hr',
          action: 'overtime-generate', entityType: 'OvertimeRecord', entityId: record.id,
          after: { otNumber, employee: emp.code, eligibleOtMinutes, otAmount },
        }, tx);
        created.push(record.id);
      });
    }

    return { generatedCount: created.length, ids: created };
  },

  // Manual OT create
  async create(session: AppSession | null, input: OvertimeCreateInput) {
    const actor = await authorize(session, 'hr:write');
    const emp = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { shift: true },
    });
    if (!emp) throw new NotFoundError('Employee not found');

    const att = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: input.employeeId, date: input.otDate } },
    });

    const shift = emp.shift;
    const shiftStartMin = shift ? parseTime(shift.startTime) : 0;
    const shiftEndMin = shift ? parseTime(shift.endTime) : 0;
    let breakMin = 0;
    if (shift?.breakStart && shift?.breakEnd) {
      breakMin = Math.max(0, parseTime(shift.breakEnd) - parseTime(shift.breakStart));
    }
    const totalWorkedMinutes = att ? minutesBetween(att.checkIn, att.checkOut) : 0;
    const regularDutyMinutes = shiftEndMin - shiftStartMin - breakMin;

    const otMonth = input.otDate.toISOString().slice(0, 7);
    let otRatePerHour = input.otRatePerHour;
    if (input.otRateType === 'BASIC_SALARY_BASED') {
      otRatePerHour = Number(emp.basicSalary) / 26 / 8;
    } else if (input.otRateType === 'GROSS_SALARY_BASED') {
      const gross = Number(emp.basicSalary) + Number(emp.houseAllowance) +
        Number(emp.transportAllowance) + Number(emp.medicalAllowance) + Number(emp.otherAllowance);
      otRatePerHour = gross / 26 / 8;
    }
    const otAmount = (input.approvedOtMinutes / 60) * otRatePerHour;

    return prisma.$transaction(async (tx) => {
      const otNumber = await nextOtNumber(input.otDate);
      const record = await tx.overtimeRecord.create({
        data: {
          otNumber, branchId: input.branchId, employeeId: input.employeeId,
          shiftId: emp.shiftId, otDate: input.otDate, otMonth,
          otType: input.otType, source: input.source, status: 'DRAFT',
          attendanceDate: input.otDate,
          checkIn: att?.checkIn, checkOut: att?.checkOut,
          totalWorkedMinutes, regularDutyMinutes, breakMinutes: breakMin,
          extraWorkedMinutes: Math.max(0, totalWorkedMinutes - breakMin - regularDutyMinutes),
          eligibleOtMinutes: input.approvedOtMinutes,
          approvedOtMinutes: input.approvedOtMinutes,
          otRateType: input.otRateType, otRatePerHour: D(otRatePerHour), otAmount: D(otAmount),
          remarks: input.remarks || null,
          createdById: actor.userId, updatedById: actor.userId,
        },
        include: OT_INCLUDE,
      });
      await recordAudit({
        actorId: actor.userId, branchId: input.branchId, module: 'hr',
        action: 'overtime-create', entityType: 'OvertimeRecord', entityId: record.id,
        after: { otNumber, source: input.source },
      }, tx);
      return record;
    });
  },

  // Submit draft → Pending Manager
  async submit(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    const ot = await prisma.overtimeRecord.findUnique({ where: { id } });
    if (!ot) throw new NotFoundError('Overtime record not found');
    if (ot.status !== 'DRAFT') throw new ValidationError('Only draft records can be submitted');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRecord.update({
        where: { id }, data: { status: 'PENDING_MANAGER', updatedById: actor.userId },
      });
      await recordAudit({
        actorId: actor.userId, branchId: ot.branchId, module: 'hr',
        action: 'overtime-submit', entityType: 'OvertimeRecord', entityId: id,
        before: { status: 'DRAFT' }, after: { status: 'PENDING_MANAGER' },
      }, tx);
      return updated;
    });
  },

  // Manager approval
  async managerApproval(session: AppSession | null, input: OvertimeManagerApprovalInput) {
    const actor = await authorize(session, 'hr:write');
    const ot = await prisma.overtimeRecord.findUnique({ where: { id: input.id } });
    if (!ot) throw new NotFoundError('Overtime record not found');
    if (ot.status !== 'PENDING_MANAGER') throw new ValidationError('Record is not pending manager approval');

    const nextStatus = input.decision === 'APPROVED' ? 'PENDING_HR'
      : input.decision === 'REJECTED' ? 'REJECTED' : 'DRAFT';

    const approvedMinutes = input.approvedOtMinutes ?? ot.approvedOtMinutes;
    const newAmount = D(approvedMinutes / 60).mul(ot.otRatePerHour);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRecord.update({
        where: { id: input.id },
        data: {
          status: nextStatus as never,
          approvedOtMinutes: approvedMinutes,
          otAmount: newAmount,
          managerStatus: input.decision,
          managerOtMinutes: approvedMinutes,
          managerRemarks: input.remarks || null,
          managerApprovedById: actor.userId,
          managerApprovedAt: new Date(),
          updatedById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId, branchId: ot.branchId, module: 'hr',
        action: 'overtime-manager-decision', entityType: 'OvertimeRecord', entityId: input.id,
        before: { status: ot.status }, after: { status: nextStatus, decision: input.decision },
      }, tx);
      return updated;
    });
  },

  // HR verification
  async hrVerification(session: AppSession | null, input: OvertimeHrVerificationInput) {
    const actor = await authorize(session, 'hr:write');
    const ot = await prisma.overtimeRecord.findUnique({ where: { id: input.id } });
    if (!ot) throw new NotFoundError('Overtime record not found');
    if (ot.status !== 'PENDING_HR') throw new ValidationError('Record is not pending HR verification');

    const nextStatus = input.decision === 'VERIFIED' ? 'PENDING_ACCOUNTS'
      : input.decision === 'REJECTED' ? 'REJECTED' : 'PENDING_MANAGER';

    const verifiedMin = input.verifiedMinutes ?? ot.approvedOtMinutes;
    const newAmount = D(verifiedMin / 60).mul(ot.otRatePerHour);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRecord.update({
        where: { id: input.id },
        data: {
          status: nextStatus as never,
          approvedOtMinutes: verifiedMin,
          otAmount: newAmount,
          hrStatus: input.decision,
          hrVerifiedMinutes: verifiedMin,
          hrRemarks: input.remarks || null,
          hrVerifiedById: actor.userId,
          hrVerifiedAt: new Date(),
          updatedById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId, branchId: ot.branchId, module: 'hr',
        action: 'overtime-hr-decision', entityType: 'OvertimeRecord', entityId: input.id,
        before: { status: ot.status }, after: { status: nextStatus, decision: input.decision },
      }, tx);
      return updated;
    });
  },

  // Accounts approval
  async accountsApproval(session: AppSession | null, input: OvertimeAccountsApprovalInput) {
    const actor = await authorize(session, 'accounts:read');
    const ot = await prisma.overtimeRecord.findUnique({ where: { id: input.id } });
    if (!ot) throw new NotFoundError('Overtime record not found');
    if (ot.status !== 'PENDING_ACCOUNTS') throw new ValidationError('Record is not pending accounts approval');

    const nextStatus = input.decision === 'APPROVED' ? 'APPROVED'
      : input.decision === 'REJECTED' ? 'REJECTED' : 'PENDING_HR';

    const finalRate = input.otRate ? D(input.otRate) : ot.otRatePerHour;
    const finalAmount = D(ot.approvedOtMinutes / 60).mul(finalRate);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRecord.update({
        where: { id: input.id },
        data: {
          status: nextStatus as never,
          otRatePerHour: finalRate,
          otAmount: finalAmount,
          accountsStatus: input.decision,
          accountsOtRate: finalRate,
          accountsOtAmount: finalAmount,
          payrollMonth: input.payrollMonth || ot.otMonth,
          costCenter: input.costCenter || null,
          accountsRemarks: input.remarks || null,
          accountsApprovedById: actor.userId,
          accountsApprovedAt: new Date(),
          updatedById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId, branchId: ot.branchId, module: 'hr',
        action: 'overtime-accounts-decision', entityType: 'OvertimeRecord', entityId: input.id,
        before: { status: ot.status }, after: { status: nextStatus, decision: input.decision },
      }, tx);
      return updated;
    });
  },

  // Post to payroll
  async postToPayroll(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    const ot = await prisma.overtimeRecord.findUnique({ where: { id } });
    if (!ot) throw new NotFoundError('Overtime record not found');
    if (ot.status !== 'APPROVED') throw new ValidationError('Only approved records can be posted to payroll');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRecord.update({
        where: { id },
        data: {
          status: 'POSTED_TO_PAYROLL',
          postedToPayroll: true,
          postedAt: new Date(),
          postedById: actor.userId,
          updatedById: actor.userId,
        },
      });
      await recordAudit({
        actorId: actor.userId, branchId: ot.branchId, module: 'hr',
        action: 'overtime-post-payroll', entityType: 'OvertimeRecord', entityId: id,
        after: { status: 'POSTED_TO_PAYROLL', amount: ot.otAmount.toString() },
      }, tx);
      return updated;
    });
  },

  // Cancel
  async cancel(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    const ot = await prisma.overtimeRecord.findUnique({ where: { id } });
    if (!ot) throw new NotFoundError('Overtime record not found');
    if (['POSTED_TO_PAYROLL', 'CANCELLED'].includes(ot.status)) {
      throw new ValidationError('Cannot cancel a posted or already cancelled record');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRecord.update({
        where: { id }, data: { status: 'CANCELLED', updatedById: actor.userId },
      });
      await recordAudit({
        actorId: actor.userId, branchId: ot.branchId, module: 'hr',
        action: 'overtime-cancel', entityType: 'OvertimeRecord', entityId: id,
        before: { status: ot.status }, after: { status: 'CANCELLED' },
      }, tx);
      return updated;
    });
  },
};
