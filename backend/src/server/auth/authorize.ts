import 'server-only';
import { canAccessBranch } from './branch-access';
import { canAccessCompany } from './company-access';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import type { Permission } from '@/lib/permissions';
import type { AppSession } from './session';

export async function authorize(
  session: AppSession | null,
  permission: Permission,
  ctx?: { branchId?: string | null; companyId?: string | null },
): Promise<AppSession> {
  if (!session) throw new UnauthorizedError();
  if (!session.permissions.includes(permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  if (ctx?.branchId && !canAccessBranch(session, ctx.branchId)) {
    throw new ForbiddenError(`Branch access denied: ${ctx.branchId}`);
  }
  if (ctx?.companyId && !canAccessCompany(session, ctx.companyId)) {
    throw new ForbiddenError(`Company access denied: ${ctx.companyId}`);
  }
  return session;
}
