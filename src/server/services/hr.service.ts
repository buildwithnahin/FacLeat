import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { approvalService } from '@/server/services/approval.service';
import { syncConfirmationReportingManagerForEmployee } from '@/server/services/confirmations.service';
import { syncIncrementReportingManagerForEmployee } from '@/server/services/increments.service';
import { calculateRequestedLeaveDays, resolveLeavePolicyForEmployee } from '@/server/services/leave-policies.service';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type {
  AttendanceMarkInput,
  EmployeeCreateInput,
  EmployeeUpdateInput,
  HrMasterDataCreateInput,
  HrMasterDataUpdateInput,
  HrWorkflowRecordCreateInput,
  HrWorkflowRecordUpdateInput,
  LeaveCreateInput,
  LeaveDecisionInput,
  PayrollRunCreateInput,
} from '@/server/validators/hr';

const ZERO = new Prisma.Decimal(0);
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

function parseTimeOn(dateStr: string, hhmm: string): Date | null {
  if (!hhmm) return null;
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(dateStr);
  d.setHours(h, m, 0, 0);
  return d;
}


function monthBounds(period: string) {
  const parts = period.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const workingDays = end.getUTCDate();
  return { start, end, workingDays };
}

export const hrService = {
  // ─── Employees ────────────────────────────────────────────────────────────
  async listEmployees(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; q?: string } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.employee.findMany({
      where: {
        branchId: filters.branchId,
        status: filters.status as never,
        OR: filters.q
          ? [
              { code: { contains: filters.q, mode: 'insensitive' } },
              { firstName: { contains: filters.q, mode: 'insensitive' } },
              { lastName: { contains: filters.q, mode: 'insensitive' } },
              { email: { contains: filters.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { branch: true, shift: true, reportingManager: true, systemRole: true },
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
    });
  },

  async getEmployee(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { branch: true, shift: true, reportingManager: true, systemRole: true, user: true },
    });
    if (!employee) throw new NotFoundError('Employee not found');
    return employee;
  },

  async createEmployee(session: AppSession | null, input: EmployeeCreateInput) {
    const actor = await authorize(session, 'hr:write');
    const dup = await prisma.employee.findUnique({ where: { code: input.code } });
    if (dup) throw new ValidationError('Employee code already exists');
    if (input.email) {
      const dupEmail = await prisma.employee.findUnique({ where: { email: input.email } });
      if (dupEmail) throw new ValidationError('Email already in use');
    }
    if (input.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: input.shiftId } });
      if (!shift) throw new ValidationError('Selected shift not found');
      if (shift.branchId !== input.branchId) throw new ValidationError('Selected shift must belong to the employee branch');
    }

    return prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          branchId: input.branchId,
          shiftId: input.shiftId || null,
          code: input.code,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone || null,
          designation: input.designation || null,
          department: input.department || null,
          employmentType: input.employmentType || 'PERMANENT',
          reportingManagerId: input.reportingManagerId || null,
          systemRoleId: input.systemRoleId || null,
          joinedAt: input.joinedAt,
          status: input.status,
          basicSalary: D(input.basicSalary),
          houseAllowance: D(input.houseAllowance),
          transportAllowance: D(input.transportAllowance),
          medicalAllowance: D(input.medicalAllowance),
          otherAllowance: D(input.otherAllowance),
          providentFund: D(input.providentFund),
          taxDeduction: D(input.taxDeduction),
          bankName: input.bankName || null,
          bankAccount: input.bankAccount || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'hr',
          action: 'create-employee',
          entityType: 'Employee',
          entityId: emp.id,
          after: {
            code: emp.code,
            name: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            designation: emp.designation,
            shiftId: emp.shiftId,
            employmentType: emp.employmentType,
          },
        },
        tx,
      );
      return emp;
    });
  },

  async updateEmployee(session: AppSession | null, input: EmployeeUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.employee.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Employee not found');
    const nextReportingManagerId = input.reportingManagerId || null;
    const reportingManagerChanged = existing.reportingManagerId !== nextReportingManagerId;
    if (input.code !== existing.code) {
      const dup = await prisma.employee.findUnique({ where: { code: input.code } });
      if (dup && dup.id !== existing.id) throw new ValidationError('Employee code already exists');
    }
    if (input.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: input.shiftId } });
      if (!shift) throw new ValidationError('Selected shift not found');
      if (shift.branchId !== input.branchId) throw new ValidationError('Selected shift must belong to the employee branch');
    }
    const updatedEmployee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id: input.id },
        data: {
          branchId: input.branchId,
          shiftId: input.shiftId || null,
          code: input.code,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone || null,
          designation: input.designation || null,
          department: input.department || null,
          employmentType: input.employmentType || 'PERMANENT',
          reportingManagerId: nextReportingManagerId,
          systemRoleId: input.systemRoleId || null,
          joinedAt: input.joinedAt,
          status: input.status,
          basicSalary: D(input.basicSalary),
          houseAllowance: D(input.houseAllowance),
          transportAllowance: D(input.transportAllowance),
          medicalAllowance: D(input.medicalAllowance),
          otherAllowance: D(input.otherAllowance),
          providentFund: D(input.providentFund),
          taxDeduction: D(input.taxDeduction),
          bankName: input.bankName || null,
          bankAccount: input.bankAccount || null,
          updatedById: actor.userId,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: emp.branchId,
          module: 'hr',
          action: 'update-employee',
          entityType: 'Employee',
          entityId: emp.id,
          before: {
            status: existing.status,
            basic: existing.basicSalary.toString(),
            department: existing.department,
            designation: existing.designation,
            shiftId: existing.shiftId,
            employmentType: existing.employmentType,
          },
          after: {
            status: emp.status,
            basic: emp.basicSalary.toString(),
            department: emp.department,
            designation: emp.designation,
            shiftId: emp.shiftId,
            employmentType: emp.employmentType,
          },
        },
        tx,
      );
      return emp;
    });

    if (reportingManagerChanged && nextReportingManagerId) {
      await syncConfirmationReportingManagerForEmployee(input.id, nextReportingManagerId);
      await syncIncrementReportingManagerForEmployee(input.id, nextReportingManagerId);
    }
    return updatedEmployee;
  },

  // ─── HR master data and lifecycle workflow records ───────────────────────
  async listMasterData(
    session: AppSession | null,
    filters: { type?: string; branchId?: string; status?: string } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.hrMasterData.findMany({
      where: {
        type: filters.type,
        status: filters.status,
        OR: filters.branchId
          ? [{ branchId: filters.branchId }, { branchId: null }]
          : undefined,
      },
      include: { branch: true },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 300,
    });
  },

  async createMasterData(session: AppSession | null, input: HrMasterDataCreateInput) {
    const actor = await authorize(session, 'hr:write');

    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.hrMasterData.create({
          data: {
            branchId: input.branchId || null,
            type: input.type,
            code: input.code || null,
            name: input.name,
            description: input.description || null,
            status: input.status || 'ACTIVE',
            metadata:
              input.type === 'designations'
                ? {
                    department: input.department || null,
                  }
                : null,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
        });
        await recordAudit(
          {
            actorId: actor.userId,
            branchId: input.branchId || null,
            module: 'hr',
            action: 'create-master-data',
            entityType: 'HrMasterData',
            entityId: row.id,
            after: { type: row.type, code: row.code, name: row.name },
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ValidationError('Code already exists for this HR section');
      }
      throw error;
    }
  },

  async updateMasterData(session: AppSession | null, input: HrMasterDataUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.hrMasterData.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('HR master data record not found');

    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.hrMasterData.update({
          where: { id: input.id },
          data: {
            branchId: input.branchId || null,
            type: input.type,
            code: input.code || null,
            name: input.name,
            description: input.description || null,
            status: input.status || 'ACTIVE',
            metadata:
              input.type === 'designations'
                ? {
                    department: input.department || null,
                  }
                : existing.metadata ?? null,
            updatedById: actor.userId,
          },
        });
        await recordAudit(
          {
            actorId: actor.userId,
            branchId: row.branchId,
            module: 'hr',
            action: 'update-master-data',
            entityType: 'HrMasterData',
            entityId: row.id,
            before: {
              branchId: existing.branchId,
              code: existing.code,
              name: existing.name,
              status: existing.status,
            },
            after: {
              branchId: row.branchId,
              code: row.code,
              name: row.name,
              status: row.status,
            },
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ValidationError('Code already exists for this HR section');
      }
      throw error;
    }
  },

  async listWorkflowRecords(
    session: AppSession | null,
    filters: { section?: string; branchId?: string; employeeId?: string; status?: string } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.hrWorkflowRecord.findMany({
      where: {
        section: filters.section,
        status: filters.status,
        employeeId: filters.employeeId,
        OR: filters.branchId
          ? [{ branchId: filters.branchId }, { branchId: null }]
          : undefined,
      },
      include: { branch: true, employee: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
  },

  async createWorkflowRecord(session: AppSession | null, input: HrWorkflowRecordCreateInput) {
    const actor = await authorize(session, 'hr:write');

    return prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: input.branchId || null,
          employeeId: input.employeeId || null,
          section: input.section,
          title: input.title,
          subject: input.subject || null,
          status: input.status || 'OPEN',
          priority: input.priority || 'NORMAL',
          startDate: input.startDate instanceof Date ? input.startDate : null,
          endDate: input.endDate instanceof Date ? input.endDate : null,
          amount: typeof input.amount === 'number' ? D(input.amount) : null,
          owner: input.owner || null,
          notes: input.notes || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId || null,
          module: 'hr',
          action: 'create-workflow-record',
          entityType: 'HrWorkflowRecord',
          entityId: row.id,
          after: { section: row.section, title: row.title, status: row.status },
        },
        tx,
      );
      return row;
    });
  },

  async updateWorkflowRecord(session: AppSession | null, input: HrWorkflowRecordUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.hrWorkflowRecord.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('HR workflow record not found');

    return prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.update({
        where: { id: input.id },
        data: {
          branchId: input.branchId || null,
          employeeId: input.employeeId || null,
          section: input.section,
          title: input.title,
          subject: input.subject || null,
          status: input.status || 'OPEN',
          priority: input.priority || 'NORMAL',
          startDate: input.startDate instanceof Date ? input.startDate : null,
          endDate: input.endDate instanceof Date ? input.endDate : null,
          amount: typeof input.amount === 'number' ? D(input.amount) : null,
          owner: input.owner || null,
          notes: input.notes || null,
          updatedById: actor.userId,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: row.branchId,
          module: 'hr',
          action: 'update-workflow-record',
          entityType: 'HrWorkflowRecord',
          entityId: row.id,
          before: {
            employeeId: existing.employeeId,
            title: existing.title,
            status: existing.status,
            priority: existing.priority,
          },
          after: {
            employeeId: row.employeeId,
            title: row.title,
            status: row.status,
            priority: row.priority,
          },
        },
        tx,
      );
      return row;
    });
  },

  // ─── Attendance ───────────────────────────────────────────────────────────
  async markAttendance(session: AppSession | null, input: AttendanceMarkInput) {
    const actor = await authorize(session, 'hr:attendance');
    const dateStr = input.date.toISOString().slice(0, 10);
    const checkIn = input.checkIn ? parseTimeOn(dateStr, input.checkIn) : null;
    const checkOut = input.checkOut ? parseTimeOn(dateStr, input.checkOut) : null;
    if (checkIn && checkOut && checkOut < checkIn) {
      throw new ValidationError('Check-out must be after check-in');
    }
    return prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date: input.date } },
      create: {
        employeeId: input.employeeId,
        date: input.date,
        status: input.status,
        checkIn,
        checkOut,
        remarks: input.remarks || null,
        createdById: actor.userId,
      },
      update: {
        status: input.status,
        checkIn,
        checkOut,
        remarks: input.remarks || null,
      },
    });
  },

  async listAttendance(
    session: AppSession | null,
    filters: { employeeId?: string; from?: Date; to?: Date; branchId?: string } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.attendanceRecord.findMany({
      where: {
        employeeId: filters.employeeId,
        date: { gte: filters.from, lte: filters.to },
        employee: filters.branchId ? { branchId: filters.branchId } : undefined,
      },
      include: { employee: true },
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      take: 500,
    });
  },

  // ─── Leave ────────────────────────────────────────────────────────────────
  async createLeave(session: AppSession | null, input: LeaveCreateInput) {
    const actor = await authorize(session, 'hr:write');
    const emp = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!emp) throw new NotFoundError('Employee not found');
    const policy = await resolveLeavePolicyForEmployee(input.employeeId, input.fromDate);
    const rule = policy.rules.find((item) => item.leaveType === input.type && item.status === 'ACTIVE');
    if (!rule) throw new ValidationError(`No active policy rule found for ${input.type}.`);
    const days = await calculateRequestedLeaveDays(input.employeeId, input.fromDate, input.toDate, rule);

    return prisma.$transaction(async (tx) => {
      const lr = await tx.leaveRequest.create({
        data: {
          employeeId: input.employeeId,
          type: input.type,
          fromDate: input.fromDate,
          toDate: input.toDate,
          days,
          reason: input.reason || null,
          createdById: actor.userId,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: emp.branchId,
          module: 'hr',
          action: 'leave-request',
          entityType: 'LeaveRequest',
          entityId: lr.id,
          after: { days, type: lr.type, status: lr.status },
        },
        tx,
      );
      return lr;
    });
  },

  async listLeaves(
    session: AppSession | null,
    filters: { status?: string; branchId?: string; employeeId?: string } = {},
  ) {
    await authorize(session, 'hr:read');
    return prisma.leaveRequest.findMany({
      where: {
        status: filters.status as never,
        employeeId: filters.employeeId,
        employee: filters.branchId ? { branchId: filters.branchId } : undefined,
      },
      include: { employee: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  },

  async decideLeave(session: AppSession | null, input: LeaveDecisionInput) {
    const actor = await authorize(session, 'hr:leave-approve');
    return prisma.$transaction(async (tx) => {
      const lr = await tx.leaveRequest.findUnique({
        where: { id: input.id },
        include: { employee: true },
      });
      if (!lr) throw new NotFoundError('Leave request not found');
      if (lr.status !== 'PENDING') throw new ValidationError('Leave is already decided');

      const updated = await tx.leaveRequest.update({
        where: { id: input.id },
        data: {
          status: input.decision,
          decidedById: actor.userId,
          decidedAt: new Date(),
          decisionNote: input.note || null,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: lr.employee.branchId,
          module: 'hr',
          action: `leave-${input.decision.toLowerCase()}`,
          entityType: 'LeaveRequest',
          entityId: lr.id,
          before: { status: lr.status },
          after: { status: updated.status },
        },
        tx,
      );
      return updated;
    });
  },

  // ─── Payroll ──────────────────────────────────────────────────────────────
  async listPayrollRuns(session: AppSession | null, filters: { branchId?: string } = {}) {
    await authorize(session, 'hr:read');
    return prisma.payrollRun.findMany({
      where: { branchId: filters.branchId },
      include: { branch: true, _count: { select: { payslips: true } } },
      orderBy: [{ period: 'desc' }],
    });
  },

  async getPayrollRun(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        branch: true,
        payslips: {
          include: { employee: true },
          orderBy: { employee: { code: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundError('Payroll run not found');
    return run;
  },

  async createPayrollRun(session: AppSession | null, input: PayrollRunCreateInput) {
    const actor = await authorize(session, 'hr:process-payroll');
    const existing = await prisma.payrollRun.findUnique({
      where: { branchId_period: { branchId: input.branchId, period: input.period } },
    });
    if (existing) throw new ValidationError(`Payroll for ${input.period} already exists`);

    const { start, end, workingDays } = monthBounds(input.period);

    const employees = await prisma.employee.findMany({
      where: { branchId: input.branchId, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
    });
    if (employees.length === 0) throw new ValidationError('No active employees in this branch');

    // Pre-compute attendance / leave day counts per employee, taking holidays into account.
    const employeeIds = employees.map((e) => e.id);
    const [attendance, leaves, activeHolidays] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: start, lte: end } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          fromDate: { lte: end },
          toDate: { gte: start },
        },
      }),
      prisma.holiday.findMany({
        where: {
          startDate: { lte: end },
          endDate: { gte: start },
          status: 'ACTIVE',
        },
      }),
    ]);
    const attByEmp = new Map<string, typeof attendance>();
    for (const a of attendance) {
      const arr = attByEmp.get(a.employeeId) ?? [];
      arr.push(a);
      attByEmp.set(a.employeeId, arr);
    }
    const leaveDaysByEmp = new Map<string, number>();
    for (const l of leaves) {
      const policy = await resolveLeavePolicyForEmployee(l.employeeId, l.fromDate);
      const rule = policy.rules.find((item) => item.leaveType === l.type && item.status === 'ACTIVE');
      if (rule && !rule.paidLeave) continue;
      const s = l.fromDate < start ? start : l.fromDate;
      const e = l.toDate > end ? end : l.toDate;
      
      const emp = employees.find((emp) => emp.id === l.employeeId);
      const empBranchId = emp?.branchId ?? null;
      
      const holidayDates = new Set<string>();
      for (const h of activeHolidays) {
        if (h.branchId !== null && h.branchId !== empBranchId) continue;
        const hStart = new Date(Math.max(h.startDate.getTime(), s.getTime()));
        const hEnd = new Date(Math.min(h.endDate.getTime(), e.getTime()));
        const cursor = new Date(hStart);
        while (cursor <= hEnd) {
          holidayDates.add(cursor.toISOString().slice(0, 10));
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      
      let d = 0;
      const cursor = new Date(s);
      const endCursor = new Date(e);
      while (cursor <= endCursor) {
        const key = cursor.toISOString().slice(0, 10);
        if (!holidayDates.has(key)) {
          d++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      leaveDaysByEmp.set(l.employeeId, (leaveDaysByEmp.get(l.employeeId) ?? 0) + d);
    }

    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          branchId: input.branchId,
          period: input.period,
          status: 'DRAFT',
          notes: input.notes || null,
          createdById: actor.userId,
        },
      });

      let totalGross = ZERO;
      let totalDed = ZERO;
      let totalNet = ZERO;

      for (const emp of employees) {
        const att = attByEmp.get(emp.id) ?? [];
        const fullDays = att.filter((a) =>
          ['PRESENT', 'LATE'].includes(a.status),
        ).length;
        const halfDays = att.filter((a) => a.status === 'HALF_DAY').length;
        const absentDays = att.filter((a) => a.status === 'ABSENT').length;
        const leaveDays = leaveDaysByEmp.get(emp.id) ?? 0;

        // Worked days = full present + half-day * 0.5
        const effectiveWorked = fullDays + halfDays * 0.5;
        const workedDays = Math.min(workingDays, Math.max(0, effectiveWorked));

        // Count paid holidays in this period that apply to this employee's branch
        const empHolidays = activeHolidays.filter(
          (h) => h.branchId === null || h.branchId === emp.branchId
        );
        
        // Paid holidays where employee was not marked present/late/half_day
        let paidHolidaysCount = 0;
        const processedHolidayDates = new Set<string>();
        for (const h of empHolidays) {
          if (!h.isPaid) continue;
          const hStart = new Date(Math.max(h.startDate.getTime(), start.getTime()));
          const hEnd = new Date(Math.min(h.endDate.getTime(), end.getTime()));
          const cursor = new Date(hStart);
          while (cursor <= hEnd) {
            const dateStr = cursor.toISOString().slice(0, 10);
            if (!processedHolidayDates.has(dateStr)) {
              processedHolidayDates.add(dateStr);
              const attOnHoliday = att.find(
                (a) => a.date.toISOString().slice(0, 10) === dateStr
              );
              if (
                !attOnHoliday ||
                ['HOLIDAY', 'ABSENT', 'ON_LEAVE'].includes(attOnHoliday.status)
              ) {
                paidHolidaysCount++;
              }
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        }

        // Prorate salary by (worked + paid leave + paid holidays) / workingDays.
        const paidDays = Math.min(workingDays, workedDays + leaveDays + paidHolidaysCount);
        const paidRatio = D(paidDays).div(workingDays).toNumber();

        const basic = emp.basicSalary.mul(D(paidRatio));
        const ha = emp.houseAllowance.mul(D(paidRatio));
        const ta = emp.transportAllowance.mul(D(paidRatio));
        const ma = emp.medicalAllowance.mul(D(paidRatio));
        const oa = emp.otherAllowance.mul(D(paidRatio));
        const gross = basic.plus(ha).plus(ta).plus(ma).plus(oa);
        const pf = emp.providentFund;
        const tax = emp.taxDeduction;
        const deductions = pf.plus(tax);
        const net = gross.minus(deductions);

        await tx.payslip.create({
          data: {
            payrollRunId: run.id,
            employeeId: emp.id,
            workedDays,
            leaveDays,
            absentDays,
            basic,
            houseAllowance: ha,
            transportAllowance: ta,
            medicalAllowance: ma,
            otherAllowance: oa,
            providentFund: pf,
            taxDeduction: tax,
            gross,
            net,
          },
        });

        totalGross = totalGross.plus(gross);
        totalDed = totalDed.plus(deductions);
        totalNet = totalNet.plus(net);
      }

      const updated = await tx.payrollRun.update({
        where: { id: run.id },
        data: { totalGross, totalDeduction: totalDed, totalNet },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'hr',
          action: 'create-payroll',
          entityType: 'PayrollRun',
          entityId: run.id,
          after: { period: input.period, employees: employees.length, net: totalNet.toString() },
        },
        tx,
      );

      return updated;
    });
  },

  async approvePayroll(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:approve-payroll');
    const pendingRun = await prisma.payrollRun.findUnique({ where: { id } });
    if (!pendingRun) throw new NotFoundError('Payroll run not found');
    if (pendingRun.status !== 'DRAFT') throw new ValidationError('Only draft runs can be approved');
    await approvalService.ensureApprovedOrRequest(session, {
      module: 'hr',
      action: 'approve-payroll',
      entityType: 'PayrollRun',
      entityId: pendingRun.id,
      title: `Payroll ${pendingRun.period}`,
      summary: `Approval required before finalizing payroll for ${pendingRun.period}`,
      amount: pendingRun.totalNet.toNumber(),
      currency: 'BDT',
      branchId: pendingRun.branchId,
    });
    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id } });
      if (!run) throw new NotFoundError('Payroll run not found');
      if (run.status !== 'DRAFT') throw new ValidationError('Only draft runs can be approved');
      const updated = await tx.payrollRun.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: actor.userId, approvedAt: new Date() },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: run.branchId,
          module: 'hr',
          action: 'approve-payroll',
          entityType: 'PayrollRun',
          entityId: run.id,
          after: { status: 'APPROVED' },
        },
        tx,
      );
      return updated;
    });
  },

  async markPayrollPaid(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:pay-payroll');
    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id } });
      if (!run) throw new NotFoundError('Payroll run not found');
      if (run.status !== 'APPROVED') throw new ValidationError('Run must be approved first');
      const updated = await tx.payrollRun.update({
        where: { id },
        data: { status: 'PAID', paidById: actor.userId, paidAt: new Date() },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: run.branchId,
          module: 'hr',
          action: 'pay-payroll',
          entityType: 'PayrollRun',
          entityId: run.id,
          after: { status: 'PAID' },
        },
        tx,
      );
      return updated;
    });
  },

  async lockPayroll(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:lock-payroll');
    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id } });
      if (!run) throw new NotFoundError('Payroll run not found');
      if (run.status !== 'PAID') throw new ValidationError('Only paid runs can be locked');
      const updated = await tx.payrollRun.update({
        where: { id },
        data: { status: 'LOCKED', lockedById: actor.userId, lockedAt: new Date() },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: run.branchId,
          module: 'hr',
          action: 'lock-payroll',
          entityType: 'PayrollRun',
          entityId: run.id,
          after: { status: 'LOCKED' },
        },
        tx,
      );
      return updated;
    });
  },

  async cancelPayroll(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:process-payroll');
    return prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id } });
      if (!run) throw new NotFoundError('Payroll run not found');
      if (run.status !== 'DRAFT') throw new ValidationError('Only draft runs can be cancelled');
      await tx.payslip.deleteMany({ where: { payrollRunId: id } });
      const updated = await tx.payrollRun.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: run.branchId,
          module: 'hr',
          action: 'cancel-payroll',
          entityType: 'PayrollRun',
          entityId: run.id,
          after: { status: 'CANCELLED' },
        },
        tx,
      );
      return updated;
    });
  },

  // ─── Late / Early Report ────────────────────────────────────────────────
  async getLateEarlyReport(
    session: AppSession | null,
    filters: {
      from: Date;
      to: Date;
      branchId?: string;
      department?: string;
      designation?: string;
      shiftId?: string;
      employeeId?: string;
      status?: string;
      lateThreshold?: number;
      earlyThreshold?: number;
    },
  ) {
    await authorize(session, 'hr:read');

    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: filters.from, lte: filters.to },
        employeeId: filters.employeeId || undefined,
        employee: {
          branchId: filters.branchId || undefined,
          department: filters.department || undefined,
          designation: filters.designation || undefined,
          shiftId: filters.shiftId || undefined,
          status: 'ACTIVE',
        },
      },
      include: {
        employee: {
          include: {
            branch: true,
            shift: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { code: 'asc' } }],
      take: 2000,
    });

    // Helper to parse "HH:MM" shift times into minutes from midnight
    const parseTime = (hhmm: string): number => {
      const parts = hhmm.split(':');
      return Number(parts[0]) * 60 + Number(parts[1]);
    };

    // Helper to get minutes from midnight for a Date
    const dateToMinutes = (d: Date): number => {
      return d.getHours() * 60 + d.getMinutes();
    };

    // Format minutes to "HH:MM" display
    const fmtMinutesToHHMM = (totalMin: number): string => {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    type ReportRow = {
      id: string;
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      branch: string;
      department: string;
      designation: string;
      shift: string;
      shiftStart: string;
      shiftEnd: string;
      date: string;
      checkIn: string;
      checkOut: string;
      lateMinutes: number;
      earlyMinutes: number;
      workedHours: string;
      otHours: string;
      status: string;
    };

    const rows: ReportRow[] = [];
    // Track per-employee monthly stats
    const monthlyMap = new Map<string, {
      employeeId: string;
      employeeName: string;
      totalDays: number;
      lateDays: number;
      earlyDays: number;
      totalLateMin: number;
      totalEarlyMin: number;
    }>();

    for (const rec of records) {
      const emp = rec.employee;
      const shift = emp.shift;
      if (!shift) continue;

      const shiftStartMin = parseTime(shift.startTime);
      const shiftEndMin = parseTime(shift.endTime);

      // Calculate break duration in minutes
      let breakMin = 0;
      if (shift.breakStart && shift.breakEnd) {
        breakMin = parseTime(shift.breakEnd) - parseTime(shift.breakStart);
        if (breakMin < 0) breakMin = 0;
      }

      // Determine late minutes
      let lateMinutes = 0;
      if (rec.checkIn) {
        const checkInMin = dateToMinutes(rec.checkIn);
        const gracedStart = shiftStartMin + (shift.lateGraceMinutes ?? 0);
        if (checkInMin > gracedStart) {
          lateMinutes = checkInMin - shiftStartMin;
        }
      }

      // Determine early exit minutes
      let earlyMinutes = 0;
      if (rec.checkOut) {
        const checkOutMin = dateToMinutes(rec.checkOut);
        const gracedEnd = shiftEndMin - (shift.earlyExitGraceMinutes ?? 0);
        if (checkOutMin < gracedEnd) {
          earlyMinutes = shiftEndMin - checkOutMin;
        }
      }

      // Apply thresholds (only include rows that meet the threshold)
      if (filters.lateThreshold && lateMinutes > 0 && lateMinutes < filters.lateThreshold) {
        lateMinutes = 0;
      }
      if (filters.earlyThreshold && earlyMinutes > 0 && earlyMinutes < filters.earlyThreshold) {
        earlyMinutes = 0;
      }

      // Determine worked hours
      let workedMinutes = 0;
      if (rec.checkIn && rec.checkOut) {
        workedMinutes = Math.max(0, (rec.checkOut.getTime() - rec.checkIn.getTime()) / (1000 * 60) - breakMin);
      }

      // Determine OT
      let otMinutes = 0;
      if (shift.overtimeAllowed && rec.checkIn && rec.checkOut) {
        const scheduledMin = shiftEndMin - shiftStartMin - breakMin;
        if (workedMinutes > scheduledMin && workedMinutes - scheduledMin >= (shift.minOtMinutes ?? 0)) {
          otMinutes = Math.min(workedMinutes - scheduledMin, shift.maxOtMinutesPerDay || 999);
        }
      }

      // Derive display status
      let derivedStatus = 'ON_TIME';
      if (rec.status === 'ABSENT') derivedStatus = 'ABSENT';
      else if (rec.status === 'ON_LEAVE') derivedStatus = 'LEAVE';
      else if (rec.status === 'HOLIDAY') derivedStatus = 'HOLIDAY';
      else if (rec.status === 'WEEKEND') derivedStatus = 'WEEKEND';
      else if (lateMinutes > 0 && earlyMinutes > 0) derivedStatus = 'LATE_EARLY';
      else if (lateMinutes > 0) derivedStatus = 'LATE';
      else if (earlyMinutes > 0) derivedStatus = 'EARLY_EXIT';

      // Apply status filter
      if (filters.status && filters.status !== derivedStatus) continue;

      // For status-filtered views, skip rows with neither late nor early unless showing all
      const dateStr = rec.date.toISOString().slice(0, 10);

      rows.push({
        id: rec.id,
        employeeId: emp.id,
        employeeCode: emp.code,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        branch: emp.branch?.name ?? '-',
        department: emp.department ?? '-',
        designation: emp.designation ?? '-',
        shift: shift.name,
        shiftStart: shift.startTime,
        shiftEnd: shift.endTime,
        date: dateStr,
        checkIn: rec.checkIn ? `${String(rec.checkIn.getHours()).padStart(2, '0')}:${String(rec.checkIn.getMinutes()).padStart(2, '0')}` : '-',
        checkOut: rec.checkOut ? `${String(rec.checkOut.getHours()).padStart(2, '0')}:${String(rec.checkOut.getMinutes()).padStart(2, '0')}` : '-',
        lateMinutes,
        earlyMinutes,
        workedHours: fmtMinutesToHHMM(Math.round(workedMinutes)),
        otHours: fmtMinutesToHHMM(otMinutes),
        status: derivedStatus,
      });

      // Accumulate monthly stats
      const existing = monthlyMap.get(emp.id);
      if (existing) {
        existing.totalDays += 1;
        if (lateMinutes > 0) {
          existing.lateDays += 1;
          existing.totalLateMin += lateMinutes;
        }
        if (earlyMinutes > 0) {
          existing.earlyDays += 1;
          existing.totalEarlyMin += earlyMinutes;
        }
      } else {
        monthlyMap.set(emp.id, {
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          totalDays: 1,
          lateDays: lateMinutes > 0 ? 1 : 0,
          earlyDays: earlyMinutes > 0 ? 1 : 0,
          totalLateMin: lateMinutes,
          totalEarlyMin: earlyMinutes,
        });
      }
    }

    // Summary calculations
    const uniqueEmployees = new Set(rows.map((r) => r.employeeId));
    const lateEmployees = new Set(rows.filter((r) => r.lateMinutes > 0).map((r) => r.employeeId));
    const earlyEmployees = new Set(rows.filter((r) => r.earlyMinutes > 0).map((r) => r.employeeId));
    const lateAndEarlyEmployees = new Set(
      rows.filter((r) => r.lateMinutes > 0 && r.earlyMinutes > 0).map((r) => r.employeeId),
    );
    const lateRows = rows.filter((r) => r.lateMinutes > 0);
    const earlyRows = rows.filter((r) => r.earlyMinutes > 0);

    const summary = {
      totalEmployees: uniqueEmployees.size,
      lateEmployees: lateEmployees.size,
      earlyExit: earlyEmployees.size,
      lateAndEarly: lateAndEarlyEmployees.size,
      avgLateMinutes: lateRows.length > 0
        ? Math.round(lateRows.reduce((s, r) => s + r.lateMinutes, 0) / lateRows.length)
        : 0,
      avgEarlyMinutes: earlyRows.length > 0
        ? Math.round(earlyRows.reduce((s, r) => s + r.earlyMinutes, 0) / earlyRows.length)
        : 0,
    };

    // Monthly statistics
    const monthlyStats = Array.from(monthlyMap.values()).map((m) => ({
      employeeId: m.employeeId,
      employeeName: m.employeeName,
      totalWorkingDays: m.totalDays,
      lateDays: m.lateDays,
      earlyExitDays: m.earlyDays,
      avgLateMinutes: m.lateDays > 0 ? Math.round(m.totalLateMin / m.lateDays) : 0,
      avgEarlyMinutes: m.earlyDays > 0 ? Math.round(m.totalEarlyMin / m.earlyDays) : 0,
    }));

    return { rows, summary, monthlyStats };
  },
};
