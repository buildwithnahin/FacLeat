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
        activeBranchId: true,
        activeCompanyId: true,
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

export interface BuildSessionOverrides {
  /** Cookie-level (web) or otherwise explicit branch override. */
  branchOverride?: string | null;
  /** Cookie-level (web) or otherwise explicit company override. */
  companyOverride?: string | null;
  /** Token-level (web JWT) active branch, used as a fallback below the override. */
  tokenActiveBranchId?: string | null;
  /** Token-level (web JWT) active company, used as a fallback below the override. */
  tokenActiveCompanyId?: string | null;
  branchByCompany?: Record<string, string>;
}

/**
 * Loads a user's roles/permissions/branch+company scope fresh from the DB
 * and assembles an AppSession. Shared by the cookie-based web getSession()
 * and the Bearer-token mobile getMobileSession() — both end up with an
 * identical AppSession shape, so every existing service function works
 * unchanged regardless of which channel the request came from.
 */
export async function buildSessionForUser(
  userId: string,
  overrides: BuildSessionOverrides = {},
): Promise<AppSession | null> {
  try {
  const userWithRoles = await getCachedUserWithRoles(userId);
  if (!userWithRoles) return null;

  const permSet = new Set<string>();
  const roleNames: string[] = [];
  for (const ur of userWithRoles.roles) {
    roleNames.push(ur.role.name);
    for (const rp of ur.role.permissions) permSet.add(rp.permission.key);
  }
  const isSuperAdmin = roleNames.some((role) => role.toLowerCase().includes('super admin'));

  const branchOverride = overrides.branchOverride ?? undefined;
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

    const companyOverride = overrides.companyOverride ?? undefined;
    const requestedActiveCompanyId = resolveSessionActiveCompanyId({
      branchAccessType: userWithRoles.branchAccessType,
      allowedCompanyIds,
      defaultCompanyId: userWithRoles.defaultCompanyId ?? null,
      // Persisted `User.activeCompanyId` (set via the switcher dropdown's
      // Bearer-authenticated /api/mobile/session/active-company route) is
      // the shared source of truth reachable from both the cookie-based web
      // session and the stateless mobile session — it sits below any
      // explicit per-request override (cookie / JWT claim) but above the
      // static default.
      activeCompanyId:
        companyOverride ??
        overrides.tokenActiveCompanyId ??
        userWithRoles.activeCompanyId ??
        userWithRoles.defaultCompanyId ??
        null,
      isSuperAdmin,
    });

    const branchByCompany = overrides.branchByCompany ?? {};
    const scopedBranchOverride =
      requestedActiveCompanyId ? branchByCompany[requestedActiveCompanyId] ?? branchOverride ?? null : branchOverride ?? null;

    let resolvedActiveBranchId = resolveSessionActiveBranchId({
      branchAccessType: userWithRoles.branchAccessType,
      allowedBranchIds,
      defaultBranchId: userWithRoles.defaultBranchId ?? null,
      // Same precedence as activeCompanyId above: explicit override, then
      // the persisted DB value (shared by web + mobile), then the default.
      activeBranchId:
        scopedBranchOverride ??
        overrides.tokenActiveBranchId ??
        userWithRoles.activeBranchId ??
        userWithRoles.defaultBranchId ??
        null,
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
      console.error('Session lookup failed:', (error as Error).message);
      return null;
    }
    throw error;
  }
}

// Permissions are loaded from DB per-request (not JWT) to avoid cookie size limits
// and to ensure permission changes take effect without requiring re-login.
// cache() deduplicates this within a single request.
export const getSession = cache(async (): Promise<AppSession | null> => {
  const s = await auth();
  if (!s?.user?.id) return null;

  const cookieStore = await cookies();

  return buildSessionForUser(s.user.id, {
    branchOverride: cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value ?? null,
    companyOverride: cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null,
    tokenActiveBranchId: s.user.activeBranchId ?? null,
    tokenActiveCompanyId: s.user.activeCompanyId ?? null,
    branchByCompany: parseActiveBranchByCompanyCookie(
      cookieStore.get(ACTIVE_BRANCH_BY_COMPANY_COOKIE)?.value,
    ),
  });
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
