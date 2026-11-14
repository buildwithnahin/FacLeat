import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { getScopedBranchIds } from '@/server/auth/data-scope';
import type { AppSession } from '@/server/auth/session';

export interface AuditFilters {
  branchId?: string;
  module?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export const auditService = {
  async list(session: AppSession | null, filters: AuditFilters = {}) {
    await authorize(session, 'audit:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const where: Prisma.AuditLogWhereInput = {
      ...(branchIds ? { branchId: { in: branchIds } } : filters.branchId ? { branchId: filters.branchId } : {}),
      module: filters.module,
      action: filters.action,
      entityType: filters.entityType,
      actorId: filters.actorId,
      createdAt:
        filters.from || filters.to
          ? { gte: filters.from, lte: filters.to }
          : undefined,
      OR: filters.search
        ? [
            { entityType: { contains: filters.search } },
            { entityId: { contains: filters.search } },
            { action: { contains: filters.search } },
            { module: { contains: filters.search } },
            { actor: { name: { contains: filters.search } } },
            { actor: { email: { contains: filters.search } } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 100,
        skip: filters.offset ?? 0,
        include: {
          actor: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { rows, total };
  },

  async modules(session: AppSession | null) {
    await authorize(session, 'audit:read');
    const rows = await prisma.auditLog.findMany({
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    });
    return rows.map((r) => r.module);
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'audit:read');
    return prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  },
};
