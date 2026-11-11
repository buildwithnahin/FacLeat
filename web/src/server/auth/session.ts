import 'server-only';
import { auth } from '@/server/auth/config';
import { backendFetch } from '@/lib/backend-client';

export type SessionBranchAccessType = 'ALL_BRANCHES' | 'ASSIGNED_BRANCHES' | 'OWN_BRANCH_ONLY';

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

interface MeResponse {
  id: string;
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

/**
 * web/'s replacement for the old direct-DB `getSession()` — same `AppSession`
 * shape every page/component already expects, but sourced from backend/'s
 * `GET /api/mobile/me` over HTTP instead of a local Prisma query. Returns
 * `null` if there's no NextAuth session at all (mirrors the old function's
 * contract of "null when logged out", used by `(app)/layout.tsx`'s
 * `if (!session) redirect('/login')` guard).
 */
export async function getSession(): Promise<AppSession | null> {
  const nextAuthSession = await auth();
  if (!nextAuthSession?.backendAccessToken) return null;

  const me = await backendFetch<MeResponse>('/api/mobile/me');
  return {
    userId: me.id,
    email: me.email,
    name: me.name,
    roles: me.roles,
    permissions: me.permissions,
    branchAccessType: me.branchAccessType,
    defaultBranchId: me.defaultBranchId,
    allowedBranchIds: me.allowedBranchIds,
    activeBranchId: me.activeBranchId,
    defaultCompanyId: me.defaultCompanyId,
    allowedCompanyIds: me.allowedCompanyIds,
    activeCompanyId: me.activeCompanyId,
  };
}
