import 'server-only';
import bcrypt from 'bcryptjs';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { UserCreateInput, UserUpdateInput } from '@/server/validators/users';
import { NotFoundError, ValidationError } from '@/lib/errors';

const USER_INCLUDE = {
  employee: { select: { id: true, code: true, firstName: true, lastName: true, designation: true, department: true } },
  defaultBranch: { select: { id: true, name: true, code: true } },
  branchAccesses: { include: { branch: { select: { id: true, name: true, code: true } } } },
  roles: { include: { role: { select: { id: true, name: true } } } },
} as const;

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

export const userService = {
  async list(session: AppSession | null) {
    await authorize(session, 'users:read');
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: USER_INCLUDE,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'users:read');
    const user = await prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async create(session: AppSession | null, input: UserCreateInput) {
    const actor = await authorize(session, 'users:write');

    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ValidationError('Email already in use');
    const employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { user: true },
    });
    if (!employee) throw new ValidationError('Employee not found');
    if (employee.user) throw new ValidationError('Employee already has a user account');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const defaultBranchId = input.defaultBranchId || employee.branchId;
    const assignedBranchIds = normalizeAssignedBranchIds({
      branchAccessType: input.branchAccessType,
      defaultBranchId,
      assignedBranchIds: input.assignedBranchIds,
      fallbackBranchId: employee.branchId,
    });

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
          branchAccesses: assignedBranchIds.length
            ? {
                createMany: {
                  data: assignedBranchIds.map((branchId) => ({ branchId })),
                },
              }
            : undefined,
          roles: {
            create: [{ roleId: input.roleId }],
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
            roleId: input.roleId,
            branchAccessType: input.branchAccessType,
            defaultBranchId,
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
    const existing = await prisma.user.findUnique({
      where: { id: input.id },
      include: USER_INCLUDE,
    });
    if (!existing) throw new NotFoundError('User not found');

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
    const defaultBranchId = input.defaultBranchId || employee.branchId;
    const assignedBranchIds = normalizeAssignedBranchIds({
      branchAccessType: input.branchAccessType,
      defaultBranchId,
      assignedBranchIds: input.assignedBranchIds,
      fallbackBranchId: employee.branchId,
    });

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
        roles: { create: [{ roleId: input.roleId }] },
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
            roleId: input.roleId,
            branchAccessType: input.branchAccessType,
            defaultBranchId,
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
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('User not found');

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
