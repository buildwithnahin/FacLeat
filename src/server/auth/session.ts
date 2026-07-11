import 'server-only';
import { cache } from 'react';
import { unstable_cache, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { auth } from './config';
import { resolveSessionActiveBranchId, type SessionBranchAccessType } from './branch-access';
import { getAllowedCompanyIds, resolveSessionActiveCompanyId } from './company-access';
import { prisma } from '@/server/db';
import {
  ACTIVE_BRANCH_BY_COMPANY_COOKIE,
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_COMPANY_COOKIE,
  parseActiveBranchByCompanyCookie,
} from '@/lib/cookies';

export interface AppSession {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  branchAccessType: SessionBranchAccessType;
  defaultBranchId: string | null;
  allowedBranchIds: string[];
  activeBranchId: string | null;
  defaultCompanyId: string | null;
  allowedCompanyIds: string[];
  activeCompanyId: string | null;
}

function isRecoverableSessionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (error.name !== 'PrismaClientInitializationError') return false;
  return (
    error.message.includes("Can't reach database server") ||
    error.message.includes('Authentication failed against database server')
  );
}

const getCachedUserWithRoles = unstable_cache(
  async (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId, status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        name: true,
        branchAccessType: true,
        defaultBranchId: true,
        defaultCompanyId: true,
        defaultBranch: { select: { companyId: true } },
        branchAccesses: {
          select: {
            branchId: true,
            branch: { select: { companyId: true } },
          },
        },
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    }),
  ['session-user-roles'],
  { revalidate: 60, tags: ['rbac'] },
);

// Permissions are loaded from DB per-request (not JWT) to avoid cookie size limits
// and to ensure permission changes take effect without requiring re-login.
// cache() deduplicates this within a single request.
export const getSession = cache(async (): Promise<AppSession | null> => {
  try {
    const s = await auth();
    if (!s?.user?.id) return null;

    const [cookieStore, userWithRoles] = await Promise.all([
      cookies(),
      getCachedUserWithRoles(s.user.id),
    ]);

    if (!userWithRoles) return null;

    const permSet = new Set<string>();
    const roleNames: string[] = [];
    for (const ur of userWithRoles.roles) {
      roleNames.push(ur.role.name);
      for (const rp of ur.role.permissions) permSet.add(rp.permission.key);
    }
    const isSuperAdmin = roleNames.some((role) => role.toLowerCase().includes('super admin'));

    const branchOverride = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
    let allowedBranchIds =
      userWithRoles.branchAccessType === 'ALL_BRANCHES'
        ? []
        : Array.from(
            new Set(
              [
                ...userWithRoles.branchAccesses.map((access) => access.branchId),
                userWithRoles.defaultBranchId,
              ].filter((branchId): branchId is string => !!branchId),
            ),
          );

    const branchCompanyMap = new Map<string, string>();
    for (const access of userWithRoles.branchAccesses) {
      branchCompanyMap.set(access.branchId, access.branch.companyId);
    }
    if (userWithRoles.defaultBranchId && userWithRoles.defaultBranch) {
      branchCompanyMap.set(userWithRoles.defaultBranchId, userWithRoles.defaultBranch.companyId);
    }

    let allowedCompanyIds =
      userWithRoles.branchAccessType === 'ALL_BRANCHES' && !isSuperAdmin
        ? Array.from(
            new Set(
              [userWithRoles.defaultCompanyId, ...branchCompanyMap.values()].filter(
                (companyId): companyId is string => !!companyId,
              ),
            ),
          )
        : getAllowedCompanyIds(
            userWithRoles.branchAccessType,
            allowedBranchIds,
            branchCompanyMap,
          );

    if (userWithRoles.branchAccessType === 'ALL_BRANCHES' && !isSuperAdmin && allowedCompanyIds.length > 0) {
      const scopedBranches = await prisma.branch.findMany({
        where: { companyId: { in: allowedCompanyIds } },
        select: { id: true, companyId: true },
      });
      allowedBranchIds = scopedBranches.map((branch) => branch.id);
      for (const branch of scopedBranches) {
        branchCompanyMap.set(branch.id, branch.companyId);
      }
      allowedCompanyIds = Array.from(new Set(scopedBranches.map((branch) => branch.companyId)));
    }

    const companyOverride = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
    const requestedActiveCompanyId = resolveSessionActiveCompanyId({
      branchAccessType: userWithRoles.branchAccessType,
      allowedCompanyIds,
      defaultCompanyId: userWithRoles.defaultCompanyId ?? null,
      activeCompanyId: companyOverride ?? s.user.activeCompanyId ?? userWithRoles.defaultCompanyId ?? null,
      isSuperAdmin,
    });

    const branchByCompany = parseActiveBranchByCompanyCookie(
      cookieStore.get(ACTIVE_BRANCH_BY_COMPANY_COOKIE)?.value,
    );
    const scopedBranchOverride =
      requestedActiveCompanyId ? branchByCompany[requestedActiveCompanyId] ?? branchOverride ?? null : branchOverride ?? null;

    let resolvedActiveBranchId = resolveSessionActiveBranchId({
      branchAccessType: userWithRoles.branchAccessType,
      allowedBranchIds,
      defaultBranchId: userWithRoles.defaultBranchId ?? null,
      activeBranchId: scopedBranchOverride ?? s.user.activeBranchId ?? userWithRoles.defaultBranchId ?? null,
      isSuperAdmin,
    });

    if (resolvedActiveBranchId && !branchCompanyMap.has(resolvedActiveBranchId)) {
      const activeBranch = await prisma.branch.findUnique({
        where: { id: resolvedActiveBranchId },
        select: { companyId: true },
      });
      if (activeBranch) {
        branchCompanyMap.set(resolvedActiveBranchId, activeBranch.companyId);
      }
    }

    if (
      requestedActiveCompanyId &&
      resolvedActiveBranchId &&
      branchCompanyMap.get(resolvedActiveBranchId) !== requestedActiveCompanyId
    ) {
      resolvedActiveBranchId =
        allowedBranchIds.find((branchId) => branchCompanyMap.get(branchId) === requestedActiveCompanyId) ?? null;
    }

    const branchScopedCompanyId = resolvedActiveBranchId
      ? branchCompanyMap.get(resolvedActiveBranchId) ?? null
      : null;

    return {
      userId: userWithRoles.id,
      email: userWithRoles.email,
      name: userWithRoles.name ?? '',
      roles: roleNames,
      permissions: [...permSet],
      branchAccessType: userWithRoles.branchAccessType,
      defaultBranchId: userWithRoles.defaultBranchId ?? null,
      allowedBranchIds,
      activeBranchId: resolvedActiveBranchId,
      defaultCompanyId: userWithRoles.defaultCompanyId ?? null,
      allowedCompanyIds,
      activeCompanyId:
        branchScopedCompanyId ?? requestedActiveCompanyId,
    };
  } catch (error) {
    if (isRecoverableSessionError(error)) {
      console.error('Session lookup failed:', error.message);
      return null;
    }
    throw error;
  }
});

export async function requireSession(): Promise<AppSession> {
  const s = await getSession();
  if (!s) throw new Error('UNAUTHENTICATED');
  return s;
}

export function authorize(session: AppSession, permission: string | string[]) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasPermission = permissions.every(p => session.permissions.includes(p));
  
  if (!hasPermission) {
    throw new Error(`UNAUTHORIZED: Missing required permissions [${permissions.join(', ')}]`);
  }
}

export function getBranchFilter(session: AppSession) {
  if (session.branchAccessType === 'ALL_BRANCHES') {
    return {};
  }
  return { branchId: { in: session.allowedBranchIds } };
}

export function invalidateRbacCache() {
  revalidateTag('rbac');
}
