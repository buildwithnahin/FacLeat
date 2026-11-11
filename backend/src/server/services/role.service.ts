import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { RoleCreateInput, RoleUpdateInput } from '@/server/validators/roles';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

const ROLE_INCLUDE = {
  company: { select: { id: true, name: true } },
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

const cachedRoleList = unstable_cache(
  () => prisma.role.findMany({ orderBy: { name: 'asc' }, include: ROLE_INCLUDE }),
  ['roles-list'],
  { revalidate: 300, tags: ['rbac'] },
);

const cachedPermissionList = unstable_cache(
  () => prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] }),
  ['permissions-list'],
  { revalidate: 300, tags: ['rbac'] },
);

function normalizeRoleDescription<T extends { name: string; isSystem: boolean; description: string | null }>(role: T): T {
  if (role.isSystem && role.name === 'Admin' && role.description === 'Branch-level admin') {
    return {
      ...role,
      description: 'Company-level admin',
    };
  }
  return role;
}

function hasSuperAdminScope(session: AppSession | null) {
  return session?.roles.some((role) => role.toLowerCase().includes('super admin')) ?? false;
}

function roleWhereForSession(session: AppSession | null) {
  if (!session?.activeCompanyId) {
    return undefined;
  }
  if (hasSuperAdminScope(session)) {
    return undefined;
  }
  return {
    OR: [{ companyId: session.activeCompanyId }, { isSystem: true }],
  };
}

function assertRoleCompanyAccess(
  session: AppSession | null,
  role: { companyId: string | null; isSystem: boolean },
) {
  if (hasSuperAdminScope(session)) return;
  if (role.isSystem) {
    throw new ForbiddenError('Only super admin can modify system roles');
  }
  if (!session?.activeCompanyId || role.companyId !== session.activeCompanyId) {
    throw new ForbiddenError('Role access denied for the active company');
  }
}

export const roleService = {
  async list(session: AppSession | null) {
    await authorize(session, 'roles:read');
    const roles = await cachedRoleList();
    const where = roleWhereForSession(session);
    const filtered = where
      ? roles.filter((role) => role.companyId === session?.activeCompanyId || role.isSystem)
      : roles;
    return filtered.map(normalizeRoleDescription);
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'roles:read');
    const role = await prisma.role.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!role) throw new NotFoundError('Role not found');
    if (!hasSuperAdminScope(session)) {
      if (!session?.activeCompanyId || (role.companyId !== session.activeCompanyId && !role.isSystem)) {
        throw new NotFoundError('Role not found');
      }
    }
    return normalizeRoleDescription(role);
  },

  async listPermissions(session: AppSession | null) {
    await authorize(session, 'roles:read');
    return cachedPermissionList();
  },

  async create(session: AppSession | null, input: RoleCreateInput) {
    const actor = await authorize(session, 'roles:write');
    if (!actor.activeCompanyId && !hasSuperAdminScope(actor)) {
      throw new ValidationError('No active company selected');
    }

    const companyId = actor.activeCompanyId ?? null;

    const dup = await prisma.role.findFirst({ where: { companyId, name: input.name } });
    if (dup) throw new ValidationError('Role name already exists');

    const perms = await prisma.permission.findMany({
      where: { key: { in: input.permissionKeys } },
      select: { id: true },
    });

    const role = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          companyId,
          name: input.name,
          description: input.description || null,
          permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
        },
        include: ROLE_INCLUDE,
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'roles',
          action: 'create',
          entityType: 'Role',
          entityId: role.id,
          after: { name: role.name, permissionKeys: input.permissionKeys },
        },
        tx,
      );
      return role;
    });
    revalidateTag('rbac');
    return role;
  },

  async update(session: AppSession | null, input: RoleUpdateInput) {
    const actor = await authorize(session, 'roles:write');
    const existing = await prisma.role.findUnique({
      where: { id: input.id },
      include: ROLE_INCLUDE,
    });
    if (!existing) throw new NotFoundError('Role not found');
    assertRoleCompanyAccess(actor, { companyId: existing.companyId, isSystem: existing.isSystem });
    if (existing.isSystem && existing.name !== input.name) {
      throw new ValidationError('Cannot rename a system role');
    }
    if (input.name !== existing.name) {
      const dup = await prisma.role.findFirst({
        where: { companyId: existing.companyId, name: input.name },
      });
      if (dup) throw new ValidationError('Role name already exists');
    }

    // Prevent a total lockout: if this role currently grants roles:write and the
    // edit would remove it, make sure at least one other role still has it.
    const hadRolesWrite = existing.permissions.some((rp) => rp.permission.key === 'roles:write');
    const willHaveRolesWrite = input.permissionKeys.includes('roles:write');
    if (hadRolesWrite && !willHaveRolesWrite) {
      const otherRolesWithAccess = await prisma.rolePermission.count({
        where: { roleId: { not: input.id }, permission: { key: 'roles:write' } },
      });
      if (otherRolesWithAccess === 0) {
        throw new ValidationError(
          'Cannot remove role management access from this role — no other role would retain it',
        );
      }
    }

    const perms = await prisma.permission.findMany({
      where: { key: { in: input.permissionKeys } },
      select: { id: true },
    });

    const role = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: input.id } });
      const role = await tx.role.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description || null,
          permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
        },
        include: ROLE_INCLUDE,
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'roles',
          action: 'update',
          entityType: 'Role',
          entityId: role.id,
          before: {
            name: existing.name,
            permissionKeys: existing.permissions.map((rp) => rp.permission.key),
          },
          after: { name: role.name, permissionKeys: input.permissionKeys },
        },
        tx,
      );
      return role;
    });
    revalidateTag('rbac');
    return role;
  },

  async remove(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'roles:delete');
    const existing = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new NotFoundError('Role not found');
    assertRoleCompanyAccess(actor, { companyId: existing.companyId, isSystem: existing.isSystem });
    if (existing.isSystem) throw new ValidationError('Cannot delete a system role');
    if (existing._count.users > 0) throw new ValidationError('Role is still assigned to users');

    await prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id } });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'roles',
          action: 'delete',
          entityType: 'Role',
          entityId: id,
          before: { name: existing.name },
        },
        tx,
      );
    });
    revalidateTag('rbac');
  },
};
