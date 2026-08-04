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
      activeBranchId: session.activeBranchId,
      activeCompanyId: session.activeCompanyId,
    }),
  );
}
