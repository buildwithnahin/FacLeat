import 'server-only';
import { prisma } from '@/server/db';
import { canAccessBranch, getAllowedBranchIds } from '@/server/auth/branch-access';
import type { AppSession } from '@/server/auth/session';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

function hasSuperAdminScope(session: AppSession | null) {
  return session?.roles.some((role) => role.toLowerCase().includes('super admin')) ?? false;
}

export async function assertBranchInScope(session: AppSession | null, branchId: string) {
  if (!canAccessBranch(session, branchId)) {
    throw new ForbiddenError(`Branch access denied: ${branchId}`);
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, companyId: true },
  });
  if (!branch) throw new NotFoundError('Branch not found');

  if (session?.activeCompanyId && branch.companyId !== session.activeCompanyId) {
    throw new ForbiddenError('Branch does not belong to the active company');
  }

  return branch;
}

export async function getScopedBranchIds(
  session: AppSession | null,
  branchId?: string | null,
): Promise<string[] | undefined> {
  if (!session) return [];

  if (branchId) {
    const branch = await assertBranchInScope(session, branchId);
    return [branch.id];
  }

  const isSuperAdmin = hasSuperAdminScope(session);
  if (!session.activeCompanyId) {
    if (session.branchAccessType === 'ALL_BRANCHES' && isSuperAdmin) {
      return undefined;
    }
    return getAllowedBranchIds(session);
  }

  if (session.branchAccessType === 'ALL_BRANCHES' && isSuperAdmin) {
    const branches = await prisma.branch.findMany({
      where: { companyId: session.activeCompanyId },
      select: { id: true },
    });
    return branches.map((item) => item.id);
  }

  const allowedBranchIds = getAllowedBranchIds(session);
  if (allowedBranchIds.length === 0) return [];

  const branches = await prisma.branch.findMany({
    where: {
      companyId: session.activeCompanyId,
      id: { in: allowedBranchIds },
    },
    select: { id: true },
  });
  return branches.map((item) => item.id);
}
