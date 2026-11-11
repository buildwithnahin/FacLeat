import type { AppSession } from './session';

export type SessionBranchAccessType =
  | 'ALL_BRANCHES'
  | 'ASSIGNED_BRANCHES'
  | 'OWN_BRANCH_ONLY';

function hasSuperAdminScope(session: AppSession | null) {
  return session?.roles.some((role) => role.toLowerCase().includes('super admin')) ?? false;
}

export function getAllowedBranchIds(session: AppSession | null): string[] {
  if (!session) return [];

  if (session.branchAccessType === 'ALL_BRANCHES') {
    return hasSuperAdminScope(session) ? [] : session.allowedBranchIds;
  }

  const ids = new Set<string>();
  for (const branchId of session.allowedBranchIds) {
    if (branchId) ids.add(branchId);
  }
  if (session.defaultBranchId) ids.add(session.defaultBranchId);
  if (session.activeBranchId) ids.add(session.activeBranchId);
  return [...ids];
}

export function canAccessBranch(session: AppSession | null, branchId: string | null | undefined) {
  if (!session || !branchId) return false;
  if (session.branchAccessType === 'ALL_BRANCHES') {
    return hasSuperAdminScope(session) ? true : getAllowedBranchIds(session).includes(branchId);
  }
  return getAllowedBranchIds(session).includes(branchId);
}

export function resolveSessionActiveBranchId(input: {
  branchAccessType: SessionBranchAccessType;
  allowedBranchIds: string[];
  defaultBranchId: string | null;
  activeBranchId: string | null;
  isSuperAdmin?: boolean;
}) {
  if (input.branchAccessType === 'ALL_BRANCHES' && input.isSuperAdmin) {
    return input.activeBranchId ?? input.defaultBranchId ?? null;
  }

  const allowed = new Set(input.allowedBranchIds.filter(Boolean));
  if (input.activeBranchId && allowed.has(input.activeBranchId)) {
    return input.activeBranchId;
  }
  if (input.defaultBranchId && allowed.has(input.defaultBranchId)) {
    return input.defaultBranchId;
  }
  return input.allowedBranchIds[0] ?? null;
}
