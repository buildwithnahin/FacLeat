import 'server-only';
import bcrypt from 'bcryptjs';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope } from '@/server/auth/data-scope';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { UserCreateInput, UserUpdateInput } from '@/server/validators/users';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

const USER_INCLUDE = {
  employee: { select: { id: true, code: true, firstName: true, lastName: true, designation: true, department: true } },
  defaultBranch: { select: { id: true, name: true, code: true, companyId: true } },
  branchAccesses: { include: { branch: { select: { id: true, name: true, code: true, companyId: true } } } },
  roles: { include: { role: { select: { id: true, name: true, isSystem: true } } } },
} as const;

function hasSuperAdminScope(session: AppSession | null) {
  return session?.roles.some((role) => role.toLowerCase().includes('super admin')) ?? false;
}

function normalizeAssignedBranchIds(input: {
  branchAccessType: 'ALL_BRANCHES' | 'ASSIGNED_BRANCHES' | 'OWN_BRANCH_ONLY';
  defaultBranchId?: string | null;
  assignedBranchIds?: string[];
  fallbackBranchId?: string | null;
}) {
  if (input.branchAccessType === 'ALL_BRANCHES') {
    return [] as string[];
  }

  if (input.branchAccessType === 'ASSIGNED_BRANCHES') {
    const ids = new Set<string>(input.assignedBranchIds ?? []);
    if (input.defaultBranchId) ids.add(input.defaultBranchId);
    return [...ids];
  }

  const branchId = input.defaultBranchId || input.fallbackBranchId;
  return branchId ? [branchId] : [];
}

async function resolveUserCompanyScope(branchIds: string[]) {
  if (branchIds.length === 0) {
    return { defaultCompanyId: null, branchesById: new Map<string, { companyId: string }>() };
  }

  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds } },
    select: { id: true, companyId: true },
  });

  if (branches.length !== branchIds.length) {
    throw new ValidationError('One or more assigned branches were not found');
  }

  const companyIds = new Set(branches.map((branch) => branch.companyId));
  if (companyIds.size > 1) {
    throw new ValidationError('A user cannot be assigned to branches from multiple companies');
  }

  return {
    defaultCompanyId: branches[0]?.companyId ?? null,
    branchesById: new Map(branches.map((branch) => [branch.id, { companyId: branch.companyId }])),
  };
}

async function resolveRoleForActor(session: AppSession | null, roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, companyId: true, isSystem: true },
  });
  if (!role) throw new ValidationError('Selected role not found');
  if (hasSuperAdminScope(session)) return role;
  if (role.isSystem) return role;
  if (!session?.activeCompanyId || role.companyId !== session.activeCompanyId) {
    throw new ForbiddenError('Selected role does not belong to the active company');
  }
  return role;
}

function userBelongsToCompany(
  user: {
    defaultCompanyId?: string | null;
    defaultBranch?: { companyId?: string | null } | null;
    branchAccesses?: { branch: { companyId: string } }[];
  },
  companyId: string | null | undefined,
) {
  if (!companyId) return true;
  if (user.defaultCompanyId === companyId) return true;
  if (user.defaultBranch?.companyId === companyId) return true;
  return user.branchAccesses?.some((access) => access.branch.companyId === companyId) ?? false;
}

export const userService = {
  async list(session: AppSession | null) {
    await authorize(session, 'users:read');
    return prisma.user.findMany({
      where: session?.activeCompanyId
        ? {
            OR: [
              { defaultCompanyId: session.activeCompanyId },
              { defaultBranch: { companyId: session.activeCompanyId } },
              { branchAccesses: { some: { branch: { companyId: session.activeCompanyId } } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: USER_INCLUDE,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'users:read');
    const user = await prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!user) throw new NotFoundError('User not found');
    if (!userBelongsToCompany(user, session?.activeCompanyId)) {
      throw new NotFoundError('User not found');
    }
    return user;
  },

  async create(session: AppSession | null, input: UserCreateInput) {
    const actor = await authorize(session, 'users:write');
    const isSuperAdmin = hasSuperAdminScope(actor);
    if (input.branchAccessType === 'ALL_BRANCHES' && !isSuperAdmin && !actor.activeCompanyId) {
      throw new ValidationError('No active company selected');
    }
    const role = await resolveRoleForActor(actor, input.roleId);

    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ValidationError('Email already in use');
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { user: true },
    });
    if (!employee) throw new ValidationError('Employee not found');
    if (employee.user) throw new ValidationError('Employee already has a user account');
    await assertBranchInScope(actor, employee.branchId);

    const passwordHash = await bcrypt.hash(input.password, 10);
    const defaultBranchId = input.defaultBranchId || employee.branchId;
    if (defaultBranchId) await assertBranchInScope(actor, defaultBranchId);
    const assignedBranchIds = normalizeAssignedBranchIds({
      branchAccessType: input.branchAccessType,
      defaultBranchId,
      assignedBranchIds: input.assignedBranchIds,
      fallbackBranchId: employee.branchId,
    });
    for (const branchId of assignedBranchIds) {
      await assertBranchInScope(actor, branchId);
    }
    const { defaultCompanyId: scopedCompanyId } = await resolveUserCompanyScope(assignedBranchIds);
    const defaultCompanyId =
      input.branchAccessType === 'ALL_BRANCHES' && !isSuperAdmin
        ? actor.activeCompanyId
        : scopedCompanyId;

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: input.employeeId,
          email: input.email,
          phone: employee.phone,
          passwordHash,
          status: input.status,
          branchAccessType: input.branchAccessType,
          defaultBranchId,
          defaultCompanyId,
          branchAccesses: assignedBranchIds.length
            ? {
                createMany: {
                  data: assignedBranchIds.map((branchId) => ({ branchId })),
                },
              }
            : undefined,
          roles: {
            create: [{ roleId: role.id }],
          },
        },
        include: USER_INCLUDE,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'users',
          action: 'create',
          entityType: 'User',
          entityId: user.id,
          after: {
            email: user.email,
            name: user.name,
            status: user.status,
            employeeId: input.employeeId,
            designation: employee.designation,
            roleId: role.id,
            branchAccessType: input.branchAccessType,
            defaultBranchId,
            defaultCompanyId,
            assignedBranchIds,
          },
        },
        tx,
      );

      return user;
    });
    revalidateTag('rbac');
    return user;
  },

  async update(session: AppSession | null, input: UserUpdateInput) {
    const actor = await authorize(session, 'users:write');
    const isSuperAdmin = hasSuperAdminScope(actor);
    if (input.branchAccessType === 'ALL_BRANCHES' && !isSuperAdmin && !actor.activeCompanyId) {
      throw new ValidationError('No active company selected');
    }
    const existing = await prisma.user.findUnique({
      where: { id: input.id },
      include: USER_INCLUDE,
    });
    if (!existing) throw new NotFoundError('User not found');
    if (!userBelongsToCompany(existing, isSuperAdmin ? null : actor.activeCompanyId)) {
      throw new NotFoundError('User not found');
    }
    const role = await resolveRoleForActor(actor, input.roleId);

    if (input.email !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email: input.email } });
      if (dup) throw new ValidationError('Email already in use');
    }
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { user: true },
    });
    if (!employee) throw new ValidationError('Employee not found');
    if (input.employeeId !== existing.employeeId && employee.user) {
      throw new ValidationError('Employee already has a user account');
    }
    await assertBranchInScope(actor, employee.branchId);
    const defaultBranchId = input.defaultBranchId || employee.branchId;
    if (defaultBranchId) await assertBranchInScope(actor, defaultBranchId);
    const assignedBranchIds = normalizeAssignedBranchIds({
      branchAccessType: input.branchAccessType,
      defaultBranchId,
      assignedBranchIds: input.assignedBranchIds,
      fallbackBranchId: employee.branchId,
    });
    for (const branchId of assignedBranchIds) {
      await assertBranchInScope(actor, branchId);
    }
    const { defaultCompanyId: scopedCompanyId } = await resolveUserCompanyScope(assignedBranchIds);
    const defaultCompanyId =
      input.branchAccessType === 'ALL_BRANCHES' && !isSuperAdmin
        ? actor.activeCompanyId
        : scopedCompanyId;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: input.id } });
      await tx.userBranchAccess.deleteMany({ where: { userId: input.id } });

      const data: {
        employeeId: string;
        name: string;
        email: string;
        phone: string | null;
        status: UserUpdateInput['status'];
        branchAccessType: UserUpdateInput['branchAccessType'];
        defaultBranchId: string | null;
        defaultCompanyId: string | null;
        passwordHash?: string;
        branchAccesses?: { createMany: { data: { branchId: string }[] } };
        roles: { create: { roleId: string }[] };
      } = {
        employeeId: input.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        email: input.email,
        phone: employee.phone,
        status: input.status,
        branchAccessType: input.branchAccessType,
        defaultBranchId,
        defaultCompanyId,
        roles: { create: [{ roleId: role.id }] },
      };
      if (assignedBranchIds.length) {
        data.branchAccesses = {
          createMany: {
            data: assignedBranchIds.map((branchId) => ({ branchId })),
          },
        };
      }
      if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);

      const updated = await tx.user.update({
        where: { id: input.id },
        data,
        include: USER_INCLUDE,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'users',
          action: input.password ? 'update-with-password' : 'update',
          entityType: 'User',
          entityId: updated.id,
          before: {
            email: existing.email,
            name: existing.name,
            status: existing.status,
            employeeId: existing.employeeId,
            roleIds: existing.roles.map((r) => r.role.id),
          },
          after: {
            email: updated.email,
            name: updated.name,
            status: updated.status,
            employeeId: input.employeeId,
            designation: employee.designation,
            roleId: role.id,
            branchAccessType: input.branchAccessType,
            defaultBranchId,
            defaultCompanyId,
            assignedBranchIds,
          },
        },
        tx,
      );

      return updated;
    });
    revalidateTag('rbac');
    return updated;
  },

  async setStatus(session: AppSession | null, id: string, status: 'ACTIVE' | 'DISABLED') {
    const actor = await authorize(session, 'users:write');
    const existing = await prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!existing) throw new NotFoundError('User not found');
    if (!userBelongsToCompany(existing, hasSuperAdminScope(actor) ? null : actor.activeCompanyId)) {
      throw new NotFoundError('User not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { status } });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'users',
          action: status === 'DISABLED' ? 'disable' : 'enable',
          entityType: 'User',
          entityId: id,
          before: { status: existing.status },
          after: { status: updated.status },
        },
        tx,
      );
      return updated;
    });
    revalidateTag('rbac');
    return updated;
  },
};
