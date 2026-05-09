import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { BranchCreateInput, BranchUpdateInput } from '@/server/validators/branches';
import { NotFoundError, ValidationError } from '@/lib/errors';

const cachedActiveBranches = unstable_cache(
  () => prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ['branches-active'],
  { revalidate: 300, tags: ['branches'] },
);

const cachedAllBranches = unstable_cache(
  () => prisma.branch.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
  ['branches-all'],
  { revalidate: 300, tags: ['branches'] },
);

export const branchService = {
  async listActive(session: AppSession | null) {
    await authorize(session, 'branches:read');
    return cachedActiveBranches();
  },

  async listAll(session: AppSession | null) {
    await authorize(session, 'branches:read');
    return cachedAllBranches();
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'branches:read');
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundError('Branch not found');
    return branch;
  },

  async create(session: AppSession | null, input: BranchCreateInput) {
    const actor = await authorize(session, 'branches:write');
    const dup = await prisma.branch.findUnique({ where: { code: input.code } });
    if (dup) throw new ValidationError('Branch code already exists');

    const branch = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          code: input.code,
          name: input.name,
          type: input.type,
          currency: input.currency,
          address: input.address || null,
          phone: input.phone || null,
          email: input.email || null,
          allowNegativeStock: input.allowNegativeStock,
          isActive: input.isActive,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'branches',
          action: 'create',
          entityType: 'Branch',
          entityId: branch.id,
          after: { code: branch.code, name: branch.name, type: branch.type },
        },
        tx,
      );
      return branch;
    });
    revalidateTag('branches');
    return branch;
  },

  async update(session: AppSession | null, input: BranchUpdateInput) {
    const actor = await authorize(session, 'branches:write');
    const existing = await prisma.branch.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Branch not found');
    if (input.code !== existing.code) {
      const dup = await prisma.branch.findUnique({ where: { code: input.code } });
      if (dup) throw new ValidationError('Branch code already exists');
    }

    const branch = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({
        where: { id: input.id },
        data: {
          code: input.code,
          name: input.name,
          type: input.type,
          currency: input.currency,
          address: input.address || null,
          phone: input.phone || null,
          email: input.email || null,
          allowNegativeStock: input.allowNegativeStock,
          isActive: input.isActive,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'branches',
          action: 'update',
          entityType: 'Branch',
          entityId: branch.id,
          before: { code: existing.code, name: existing.name, isActive: existing.isActive },
          after: { code: branch.code, name: branch.name, isActive: branch.isActive },
        },
        tx,
      );
      return branch;
    });
    revalidateTag('branches');
    return branch;
  },
};
