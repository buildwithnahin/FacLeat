import 'server-only';
import { prisma } from '@/server/db';
import { authorize, getScopedBranchIds } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { HolidayCreateInput, HolidayUpdateInput } from '@/server/validators/holidays';
import { NotFoundError, ValidationError } from '@/lib/errors';

const HOLIDAY_INCLUDE = {
  branch: { select: { id: true, name: true, code: true } },
} as const;

function normalizeDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function deriveHolidayCode(name: string, date: Date) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${base || 'HOLIDAY'}_${date.toISOString().slice(0, 10).replace(/-/g, '')}`;
}

export async function getHolidayForDate(date: Date, branchId?: string | null) {
  const normalizedDate = normalizeDate(date);
  return prisma.holiday.findFirst({
    where: {
      startDate: { lte: normalizedDate },
      endDate: { gte: normalizedDate },
      status: 'ACTIVE',
      OR: branchId ? [{ branchId: null }, { branchId }] : [{ branchId: null }],
    },
    include: HOLIDAY_INCLUDE,
    orderBy: [{ branchId: 'desc' }, { name: 'asc' }],
  });
}

export async function isHoliday(date: Date, branchId?: string | null) {
  return Boolean(await getHolidayForDate(date, branchId));
}

export async function listActiveHolidaysInRange(from: Date, to: Date, branchId?: string | null) {
  return prisma.holiday.findMany({
    where: {
      startDate: {
        lte: normalizeDate(to),
      },
      endDate: {
        gte: normalizeDate(from),
      },
      status: 'ACTIVE',
      OR: branchId ? [{ branchId: null }, { branchId }] : [{ branchId: null }],
    },
    include: HOLIDAY_INCLUDE,
    orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
  });
}

export async function countChargeableLeaveDays(from: Date, to: Date, branchId?: string | null) {
  const holidays = await listActiveHolidaysInRange(from, to, branchId);
  const holidaySet = new Set<string>();
  for (const h of holidays) {
    const hStart = new Date(Math.max(normalizeDate(h.startDate).getTime(), normalizeDate(from).getTime()));
    const hEnd = new Date(Math.min(normalizeDate(h.endDate).getTime(), normalizeDate(to).getTime()));
    const cursor = new Date(hStart);
    while (cursor <= hEnd) {
      holidaySet.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  let days = 0;
  const cursor = normalizeDate(from);
  const end = normalizeDate(to);

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    if (!holidaySet.has(key)) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export const holidaysService = {
  async listAll(session: AppSession | null, branchId?: string) {
    await authorize(session, 'hr:read');
    const branchIds = await getScopedBranchIds(session, branchId);
    return prisma.holiday.findMany({
      where: branchIds
        ? {
            OR: [
              { branchId: null },
              { branchId: { in: branchIds } },
            ],
          }
        : undefined,
      include: HOLIDAY_INCLUDE,
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    });
  },

  async listOnDate(session: AppSession | null, date: Date) {
    await authorize(session, 'hr:read');
    const normalizedDate = normalizeDate(date);
    return prisma.holiday.findMany({
      where: {
        startDate: { lte: normalizedDate },
        endDate: { gte: normalizedDate },
        status: 'ACTIVE',
      },
      include: HOLIDAY_INCLUDE,
      orderBy: [{ branchId: 'desc' }, { name: 'asc' }],
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const holiday = await prisma.holiday.findUnique({
      where: { id },
      include: HOLIDAY_INCLUDE,
    });
    if (!holiday) throw new NotFoundError('Holiday not found');
    return holiday;
  },

  async create(session: AppSession | null, input: HolidayCreateInput) {
    const actor = await authorize(session, 'hr:write');
    const normalizedStart = normalizeDate(input.startDate);
    const normalizedEnd = normalizeDate(input.endDate);
    if (normalizedEnd < normalizedStart) {
      throw new ValidationError('End date must be on or after start date');
    }
    const code = (input.code || deriveHolidayCode(input.name, normalizedStart)).toUpperCase();
    const duplicate = await prisma.holiday.findUnique({ where: { code } });
    if (duplicate) throw new ValidationError('Holiday code already exists');

    return prisma.$transaction(async (tx) => {
      const holiday = await tx.holiday.create({
        data: {
          name: input.name,
          code,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          type: input.type,
          branchId: input.branchId || null,
          isPaid: input.isPaid,
          status: input.status,
          description: input.description || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: holiday.branchId,
          module: 'hr',
          action: 'create-holiday',
          entityType: 'Holiday',
          entityId: holiday.id,
          after: {
            code: holiday.code,
            name: holiday.name,
            startDate: holiday.startDate.toISOString().slice(0, 10),
            endDate: holiday.endDate.toISOString().slice(0, 10),
            type: holiday.type,
          },
        },
        tx,
      );

      return holiday;
    });
  },

  async update(session: AppSession | null, input: HolidayUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.holiday.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Holiday not found');

    const normalizedStart = normalizeDate(input.startDate);
    const normalizedEnd = normalizeDate(input.endDate);
    if (normalizedEnd < normalizedStart) {
      throw new ValidationError('End date must be on or after start date');
    }
    const code = (input.code || deriveHolidayCode(input.name, normalizedStart)).toUpperCase();
    if (code !== existing.code) {
      const duplicate = await prisma.holiday.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== input.id) throw new ValidationError('Holiday code already exists');
    }

    return prisma.$transaction(async (tx) => {
      const holiday = await tx.holiday.update({
        where: { id: input.id },
        data: {
          name: input.name,
          code,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          type: input.type,
          branchId: input.branchId || null,
          isPaid: input.isPaid,
          status: input.status,
          description: input.description || null,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: holiday.branchId,
          module: 'hr',
          action: 'update-holiday',
          entityType: 'Holiday',
          entityId: holiday.id,
          before: {
            code: existing.code,
            name: existing.name,
            startDate: existing.startDate.toISOString().slice(0, 10),
            endDate: existing.endDate.toISOString().slice(0, 10),
            status: existing.status,
            isPaid: existing.isPaid,
          },
          after: {
            code: holiday.code,
            name: holiday.name,
            startDate: holiday.startDate.toISOString().slice(0, 10),
            endDate: holiday.endDate.toISOString().slice(0, 10),
            status: holiday.status,
            isPaid: holiday.isPaid,
          },
        },
        tx,
      );

      return holiday;
    });
  },
};
