import 'server-only';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CategoryTypeCreateInput,
} from '@/server/validators/product-categories';
import { NotFoundError, ValidationError } from '@/lib/errors';

const CATEGORY_INCLUDE = {
  parent: { select: { id: true, name: true } },
  _count: { select: { products: true, children: true } },
} as const;

export const categoryService = {
  async list(session: AppSession | null, query?: { type?: string; search?: string }) {
    await authorize(session, 'inventory:read');
    const where: Record<string, any> = {};
    if (session?.activeCompanyId) {
      where.companyId = session.activeCompanyId;
    }

    if (query?.type && query.type !== 'ALL') {
      if (query.type === 'UNASSIGNED') {
        where.type = null;
      } else {
        where.type = query.type;
      }
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s } },
        { description: { contains: s } },
        { type: { contains: s } },
      ];
    }

    return prisma.productCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: CATEGORY_INCLUDE,
    });
  },

  async listFlat(session: AppSession | null) {
    await authorize(session, 'inventory:read');
    return prisma.productCategory.findMany({
      where: { companyId: session?.activeCompanyId ?? undefined },
      orderBy: { name: 'asc' },
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'inventory:read');
    const cat = await prisma.productCategory.findUnique({ where: { id }, include: CATEGORY_INCLUDE });
    if (!cat) throw new NotFoundError('Category not found');
    return cat;
  },

  async listTypes(session: AppSession | null) {
    await authorize(session, 'inventory:read');
    const companyId = session?.activeCompanyId ?? undefined;
    return prisma.productCategoryType.findMany({
      where: companyId ? { companyId, isActive: true } : { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async createType(session: AppSession | null, input: CategoryTypeCreateInput) {
    const actor = await authorize(session, 'inventory:write');
    if (!actor.activeCompanyId) throw new ValidationError('No active company selected');

    const name = input.name.trim();
    const rawCode = input.code?.trim() || name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const code = rawCode || 'CUSTOM_TYPE';

    // Check duplicate code or name for company
    const existing = await prisma.productCategoryType.findFirst({
      where: {
        companyId: actor.activeCompanyId,
        OR: [{ name }, { code }],
      },
    });
    if (existing) {
      if (existing.name.toLowerCase() === name.toLowerCase()) {
        throw new ValidationError('A category type with this name already exists');
      }
      throw new ValidationError('A category type with this code already exists');
    }

    return prisma.$transaction(async (tx) => {
      const typeRecord = await tx.productCategoryType.create({
        data: {
          companyId: actor.activeCompanyId!,
          code,
          name,
          description: input.description?.trim() || null,
          isActive: true,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'inventory',
          action: 'category_type.create',
          entityType: 'ProductCategoryType',
          entityId: typeRecord.id,
          after: { code: typeRecord.code, name: typeRecord.name },
        },
        tx,
      );

      return typeRecord;
    });
  },

  async create(session: AppSession | null, input: CategoryCreateInput) {
    const actor = await authorize(session, 'inventory:write');
    if (!actor.activeCompanyId) throw new ValidationError('No active company selected');
    const dup = await prisma.productCategory.findUnique({
      where: { companyId_name: { companyId: actor.activeCompanyId, name: input.name } },
    });
    if (dup) throw new ValidationError('Category name already exists');

    return prisma.$transaction(async (tx) => {
      const cat = await tx.productCategory.create({
        data: {
          companyId: actor.activeCompanyId!,
          name: input.name,
          type: input.type?.trim() || null,
          description: input.description || null,
          parentId: input.parentId || null,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'inventory',
          action: 'category.create',
          entityType: 'ProductCategory',
          entityId: cat.id,
          after: { name: cat.name, type: cat.type, parentId: cat.parentId },
        },
        tx,
      );
      return cat;
    });
  },

  async update(session: AppSession | null, input: CategoryUpdateInput) {
    const actor = await authorize(session, 'inventory:write');
    const existing = await prisma.productCategory.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Category not found');
    if (input.parentId === input.id) throw new ValidationError('A category cannot be its own parent');
    if (input.name !== existing.name) {
      const dup = await prisma.productCategory.findUnique({
        where: { companyId_name: { companyId: existing.companyId, name: input.name } },
      });
      if (dup) throw new ValidationError('Category name already exists');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id: input.id },
        data: {
          name: input.name,
          type: input.type !== undefined ? (input.type?.trim() || null) : existing.type,
          description: input.description || null,
          parentId: input.parentId || null,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'inventory',
          action: 'category.update',
          entityType: 'ProductCategory',
          entityId: updated.id,
          before: { name: existing.name, type: existing.type, parentId: existing.parentId },
          after: { name: updated.name, type: updated.type, parentId: updated.parentId },
        },
        tx,
      );
      return updated;
    });
  },
};
