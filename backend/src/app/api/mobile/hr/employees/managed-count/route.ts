import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';

/**
 * Used to gate the increment/confirmation "reporting manager" create flow —
 * mirrors the old page-level `isReportingManagerUser()` check (does this
 * session's user manage at least one active employee in this branch?).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
  const count = await prisma.employee.count({
    where: {
      branchId,
      status: 'ACTIVE',
      reportingManager: { user: { id: session.userId } },
    },
  });
  return Response.json(apiOk({ count }));
}
