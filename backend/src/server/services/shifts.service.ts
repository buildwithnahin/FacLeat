import 'server-only';
import { prisma } from '@/server/db';
import { authorize, getScopedBranchIds } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { ShiftCreateInput, ShiftUpdateInput } from '@/server/validators/shifts';
import { NotFoundError, ValidationError } from '@/lib/errors';

const SHIFT_INCLUDE = {
  branch: { select: { id: true, name: true, code: true } },
  _count: { select: { employees: true } },
} as const;

export const shiftsService = {
  async listAll(session: AppSession | null, branchId?: string) {
    await authorize(session, 'hr:read');
    const branchIds = await getScopedBranchIds(session, branchId);
    return prisma.shift.findMany({
      where: branchIds ? { branchId: { in: branchIds } } : undefined,
      include: SHIFT_INCLUDE,
      orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
    });
  },

  async listActive(session: AppSession | null, branchId?: string) {
    await authorize(session, 'hr:read');
    return prisma.shift.findMany({
      where: {
        status: 'ACTIVE',
        branchId,
      },
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: SHIFT_INCLUDE,
    });
    if (!shift) throw new NotFoundError('Shift not found');
    return shift;
  },

  async create(session: AppSession | null, input: ShiftCreateInput) {
    const actor = await authorize(session, 'hr:write');

    const duplicate = await prisma.shift.findUnique({
      where: { branchId_code: { branchId: input.branchId, code: input.code } },
    });
    if (duplicate) throw new ValidationError('Shift code already exists for this branch');

    return prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          branchId: input.branchId,
          name: input.name,
          code: input.code,
          status: input.status,
          description: input.description || null,
          shiftType: input.shiftType,
          startTime: input.startTime,
          endTime: input.endTime,
          breakStart: input.breakStart || null,
          breakEnd: input.breakEnd || null,
          lateGraceMinutes: input.lateGraceMinutes,
          earlyExitGraceMinutes: input.earlyExitGraceMinutes,
          minPresentMinutes: input.minPresentMinutes,
          minHalfDayMinutes: input.minHalfDayMinutes,
          absentBelowMinutes: input.absentBelowMinutes,
          overtimeAllowed: input.overtimeAllowed,
          otStartsAfter: input.otStartsAfter || null,
          minOtMinutes: input.minOtMinutes,
          maxOtMinutesPerDay: input.maxOtMinutesPerDay,
          weeklyOffDays: input.weeklyOffDays,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: shift.branchId,
          module: 'hr',
          action: 'create-shift',
          entityType: 'Shift',
          entityId: shift.id,
          after: { code: shift.code, name: shift.name, type: shift.shiftType, status: shift.status },
        },
        tx,
      );

      return shift;
    });
  },

  async update(session: AppSession | null, input: ShiftUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.shift.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Shift not found');

    if (existing.branchId !== input.branchId || existing.code !== input.code) {
      const duplicate = await prisma.shift.findUnique({
        where: { branchId_code: { branchId: input.branchId, code: input.code } },
      });
      if (duplicate && duplicate.id !== input.id) {
        throw new ValidationError('Shift code already exists for this branch');
      }
    }

    return prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({
        where: { id: input.id },
        data: {
          branchId: input.branchId,
          name: input.name,
          code: input.code,
          status: input.status,
          description: input.description || null,
          shiftType: input.shiftType,
          startTime: input.startTime,
          endTime: input.endTime,
          breakStart: input.breakStart || null,
          breakEnd: input.breakEnd || null,
          lateGraceMinutes: input.lateGraceMinutes,
          earlyExitGraceMinutes: input.earlyExitGraceMinutes,
          minPresentMinutes: input.minPresentMinutes,
          minHalfDayMinutes: input.minHalfDayMinutes,
          absentBelowMinutes: input.absentBelowMinutes,
          overtimeAllowed: input.overtimeAllowed,
          otStartsAfter: input.otStartsAfter || null,
          minOtMinutes: input.minOtMinutes,
          maxOtMinutesPerDay: input.maxOtMinutesPerDay,
          weeklyOffDays: input.weeklyOffDays,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: shift.branchId,
          module: 'hr',
          action: 'update-shift',
          entityType: 'Shift',
          entityId: shift.id,
          before: {
            code: existing.code,
            name: existing.name,
            status: existing.status,
            shiftType: existing.shiftType,
          },
          after: {
            code: shift.code,
            name: shift.name,
            status: shift.status,
            shiftType: shift.shiftType,
          },
        },
        tx,
      );

      return shift;
    });
  },
};
