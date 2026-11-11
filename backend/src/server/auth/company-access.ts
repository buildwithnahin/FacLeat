import type { AppSession } from './session';

function hasSuperAdminScope(session: AppSession | null) {
  return session?.roles.some((role) => role.toLowerCase().includes('super admin')) ?? false;
}

// Company access is derived from branch access, not tracked independently:
// a user's allowed companies are the distinct companies of their allowed
// branches. Branch.companyId is required and Employee.branchId is required,
// so every user is transitively pinned to the companies of their branches —
// a separate UserCompanyAccess table would just be a second source of truth
// that can drift from the branch grants.

export function getAllowedCompanyIds(
  branchAccessType: AppSession['branchAccessType'],
  allowedBranchIds: string[],
  branchCompanyMap: Map<string, string>,
): string[] {
  if (branchAccessType === 'ALL_BRANCHES') {
    return [];
  }

  const ids = new Set<string>();
  for (const branchId of allowedBranchIds) {
    const companyId = branchCompanyMap.get(branchId);
    if (companyId) ids.add(companyId);
  }
  return [...ids];
}

export function canAccessCompany(session: AppSession | null, companyId: string | null | undefined) {
  if (!session || !companyId) return false;
  if (session.branchAccessType === 'ALL_BRANCHES') {
    return hasSuperAdminScope(session) ? true : session.allowedCompanyIds.includes(companyId);
  }
  return session.allowedCompanyIds.includes(companyId);
}

export function resolveSessionActiveCompanyId(input: {
  branchAccessType: AppSession['branchAccessType'];
  allowedCompanyIds: string[];
  defaultCompanyId: string | null;
  activeCompanyId: string | null;
  isSuperAdmin?: boolean;
}) {
  if (input.branchAccessType === 'ALL_BRANCHES' && input.isSuperAdmin) {
    return input.activeCompanyId ?? input.defaultCompanyId ?? null;
  }

  const allowed = new Set(input.allowedCompanyIds.filter(Boolean));
  if (input.activeCompanyId && allowed.has(input.activeCompanyId)) {
    return input.activeCompanyId;
  }
  if (input.defaultCompanyId && allowed.has(input.defaultCompanyId)) {
    return input.defaultCompanyId;
  }
  return input.allowedCompanyIds[0] ?? input.defaultCompanyId ?? null;
}
