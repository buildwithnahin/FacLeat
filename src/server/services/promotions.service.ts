import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification } from '@/server/notifications/publisher';
import type { AppSession } from '@/server/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type {
  PromotionCreateInput,
  PromotionUpdateInput,
  PromotionStatusActionInput,
} from '@/server/validators/promotions';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const PROMOTION_TABLE_UNAVAILABLE_MESSAGE =
  'Promotions are not available yet because the EmployeePromotion table has not been migrated in this database.';
const PROMOTION_TABLE_CACHE_TTL_MS = 60_000;

let promotionTableAvailabilityCache:
  | {
      checkedAt: number;
      available: boolean;
    }
  | undefined;

export function isEmployeePromotionTableMissingError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const table = String((error as { meta?: { table?: string } } | null)?.meta?.table ?? '');
  return code === 'P2021' && table.includes('EmployeePromotion');
}

export async function isPromotionTableAvailable(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    promotionTableAvailabilityCache &&
    now - promotionTableAvailabilityCache.checkedAt < PROMOTION_TABLE_CACHE_TTL_MS
  ) {
    return promotionTableAvailabilityCache.available;
  }

  const rows = await prisma.$queryRaw<Array<{ exists: number } | { exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'EmployeePromotion'
    ) AS "exists"
  `;

  const available = Boolean(rows[0]?.exists);
  promotionTableAvailabilityCache = { checkedAt: now, available };
  return available;
}

async function assertPromotionTableAvailable() {
  const available = await isPromotionTableAvailable();
  if (!available) {
    throw new ValidationError(PROMOTION_TABLE_UNAVAILABLE_MESSAGE);
  }
}

async function nextPromotionNumber(): Promise<string> {
  const last = await prisma.employeePromotion.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { promotionNumber: true },
  });
  const seq = last ? parseInt(last.promotionNumber.replace('PRM-', ''), 10) + 1 : 1;
  return `PRM-${String(seq).padStart(4, '0')}`;
}

const promotionIncludes = {
  branch: { select: { id: true, code: true, name: true } },
  employee: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: true,
      basicSalary: true,
      user: { select: { id: true } },
    },
  },
  reportingManager: { select: { id: true, code: true, firstName: true, lastName: true, user: { select: { id: true } } } },
} as const;

function promotionDetailText(record: {
  newDesignation: string;
  newSalary: Prisma.Decimal;
  effectiveDate: Date;
}) {
  return `${record.newDesignation} · ${record.newSalary.toString()} effective ${record.effectiveDate.toISOString().slice(0, 10)}`;
}

function assertManagerCanApprove(session: AppSession | null, promotion: Awaited<ReturnType<typeof prisma.employeePromotion.findUnique>>) {
  if (!session) throw new UnauthorizedError();
  const managerUserId = promotion?.reportingManager?.user?.id ?? null;
  if (!managerUserId || session.userId !== managerUserId) {
    throw new ForbiddenError('Only the assigned reporting manager can approve or reject this promotion');
  }
}

export const promotionsService = {
  async list(
    session: AppSession | null,
    filters: {
      branchId?: string;
      employeeId?: string;
      status?: string;
      promotionType?: string;
      q?: string;
    } = {},
  ) {
    await authorize(session, 'hr:read');
    await assertPromotionTableAvailable();
    return prisma.employeePromotion.findMany({
      where: {
        branchId: filters.branchId,
        employeeId: filters.employeeId,
        status: filters.status as never,
        promotionType: filters.promotionType as never,
        OR: filters.q
          ? [
              { promotionNumber: { contains: filters.q, mode: 'insensitive' } },
              { employee: { firstName: { contains: filters.q, mode: 'insensitive' } } },
              { employee: { lastName: { contains: filters.q, mode: 'insensitive' } } },
              { employee: { code: { contains: filters.q, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: promotionIncludes,
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    await assertPromotionTableAvailable();
    const promotion = await prisma.employeePromotion.findUnique({
      where: { id },
      include: promotionIncludes,
    });
    if (!promotion) throw new NotFoundError('Promotion not found');
    return promotion;
  },

  async create(session: AppSession | null, input: PromotionCreateInput) {
    const actor = await authorize(session, 'hr:write');
    await assertPromotionTableAvailable();
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { branch: true, reportingManager: { include: { user: true } } },
    });
    if (!employee) throw new ValidationError('Employee not found');
    if (employee.designation === input.newDesignation && Number(employee.basicSalary) === input.newSalary) {
      throw new ValidationError('Promotion must change designation or salary');
    }

    const promotionNumber = await nextPromotionNumber();

    return prisma.$transaction(async (tx) => {
      const record = await tx.employeePromotion.create({
        data: {
          promotionNumber,
          branchId: employee.branchId,
          employeeId: employee.id,
          promotionType: input.promotionType,
          status: 'DRAFT',
          currentBranch: employee.branch.name,
          currentDepartment: employee.department ?? null,
          currentDesignation: employee.designation ?? null,
          currentSalary: employee.basicSalary,
          reportingManagerId: employee.reportingManagerId ?? null,
          newDesignation: input.newDesignation,
          newSalary: D(input.newSalary),
          effectiveDate: input.effectiveDate,
          reason: input.reason,
          remarks: input.remarks || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
        include: promotionIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: record.branchId,
          module: 'hr',
          action: 'create-promotion',
          entityType: 'EmployeePromotion',
          entityId: record.id,
          after: {
            promotionNumber: record.promotionNumber,
            employeeCode: record.employee.code,
            status: record.status,
          },
        },
        tx,
      );

      return record;
    });
  },

  async update(session: AppSession | null, input: PromotionUpdateInput) {
    const actor = await authorize(session, 'hr:write');
    await assertPromotionTableAvailable();
    const existing = await prisma.employeePromotion.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Promotion not found');
    if (existing.status !== 'DRAFT') throw new ValidationError('Only draft promotions can be edited');

    return prisma.$transaction(async (tx) => {
      const record = await tx.employeePromotion.update({
        where: { id: input.id },
        data: {
          promotionType: input.promotionType,
          newDesignation: input.newDesignation,
          newSalary: D(input.newSalary),
          effectiveDate: input.effectiveDate,
          reason: input.reason,
          remarks: input.remarks || null,
          updatedById: actor.userId,
        },
        include: promotionIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: record.branchId,
          module: 'hr',
          action: 'update-promotion',
          entityType: 'EmployeePromotion',
          entityId: record.id,
          before: { status: existing.status, designation: existing.newDesignation },
          after: { status: record.status, designation: record.newDesignation },
        },
        tx,
      );

      return record;
    });
  },

  async changeStatus(session: AppSession | null, input: PromotionStatusActionInput) {
    await assertPromotionTableAvailable();
    const promotion = await prisma.employeePromotion.findUnique({
      where: { id: input.id },
      include: promotionIncludes,
    });
    if (!promotion) throw new NotFoundError('Promotion not found');

    const validTransitions: Record<string, string[]> = {
      submit: ['DRAFT'],
      manager_approve: ['PENDING_MANAGER_APPROVAL'],
      manager_reject: ['PENDING_MANAGER_APPROVAL'],
    };

    const allowed = validTransitions[input.action];
    if (!allowed || !allowed.includes(promotion.status)) {
      throw new ValidationError(`Cannot ${input.action} a promotion in ${promotion.status} status`);
    }

    const actor =
      input.action === 'submit'
        ? await authorize(session, 'hr:write')
        : (assertManagerCanApprove(session, promotion), session as AppSession);

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateData: Prisma.EmployeePromotionUpdateInput = {
        updatedById: actor.userId,
      };

      if (input.action === 'submit') {
        updateData.status = 'PENDING_MANAGER_APPROVAL';
      } else if (input.action === 'manager_approve') {
        updateData.status = 'COMPLETED';
        updateData.managerApprovalStatus = 'APPROVED';
        updateData.managerApprovalDate = now;
        updateData.managerRemarks = input.note || null;
        updateData.approvedAt = now;
        updateData.completedAt = now;

        await tx.employee.update({
          where: { id: promotion.employeeId },
          data: {
            designation: promotion.newDesignation,
            basicSalary: promotion.newSalary,
          },
        });

        await tx.contract.updateMany({
          where: {
            employeeId: promotion.employeeId,
            status: { in: ['ACTIVE', 'SIGNED', 'WAITING_FOR_JOINING'] },
          },
          data: {
            designation: promotion.newDesignation,
            basicSalary: promotion.newSalary,
            updatedById: actor.userId,
          },
        });
      } else if (input.action === 'manager_reject') {
        updateData.status = 'REJECTED_BY_MANAGER';
        updateData.managerApprovalStatus = 'REJECTED';
        updateData.managerApprovalDate = now;
        updateData.managerRemarks = input.note || null;
      }

      const updated = await tx.employeePromotion.update({
        where: { id: promotion.id },
        data: updateData,
        include: promotionIncludes,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: promotion.branchId,
          module: 'hr',
          action: `promotion-${input.action}`,
          entityType: 'EmployeePromotion',
          entityId: promotion.id,
          before: { status: promotion.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });

    if (input.action === 'submit' && promotion.reportingManager?.user?.id) {
      await publishNotification({
        recipientId: promotion.reportingManager.user.id,
        branchId: promotion.branchId,
        module: 'hr',
        title: `Promotion approval needed: ${promotion.employee.firstName} ${promotion.employee.lastName}`,
        body: promotionDetailText(promotion),
        href: '/hr/promotions',
      });
    }

    if (input.action === 'manager_reject' && promotion.createdById) {
      await publishNotification({
        recipientId: promotion.createdById,
        branchId: promotion.branchId,
        severity: 'WARNING',
        module: 'hr',
        title: `Promotion ${result.status.toLowerCase().replaceAll('_', ' ')}`,
        body: input.note || promotionDetailText(promotion),
        href: '/hr/promotions',
      });
    }

    if (input.action === 'manager_approve' && promotion.employee.user?.id) {
      await publishNotification({
        recipientId: promotion.employee.user.id,
        branchId: promotion.branchId,
        module: 'hr',
        title: 'Promotion effective',
        body: promotionDetailText(promotion),
        href: `/hr/employees/${promotion.employeeId}`,
      });
    }

    return result;
  },

  async countByStatus(session: AppSession | null, branchId?: string) {
    await authorize(session, 'hr:read');
    await assertPromotionTableAvailable();
    const counts = await prisma.employeePromotion.groupBy({
      by: ['status'],
      where: branchId ? { branchId } : undefined,
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const row of counts) result[row.status] = row._count;
    return result;
  },
};
