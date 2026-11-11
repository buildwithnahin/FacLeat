import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  return Response.json(
    apiOk({
      id: session.userId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      permissions: session.permissions,
      // branchAccessType/defaultBranchId/allowedBranchIds/allowedCompanyIds
      // added for the web app's AppShell (needs the full AppSession shape it
      // used to get from direct getSession() calls) — purely additive, the
      // Flutter app's MeProfile.fromJson ignores fields it doesn't know.
      branchAccessType: session.branchAccessType,
      defaultBranchId: session.defaultBranchId,
      allowedBranchIds: session.allowedBranchIds,
      activeBranchId: session.activeBranchId,
      defaultCompanyId: session.defaultCompanyId,
      allowedCompanyIds: session.allowedCompanyIds,
      activeCompanyId: session.activeCompanyId,
    }),
  );
}
