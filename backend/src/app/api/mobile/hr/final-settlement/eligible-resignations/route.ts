import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

/**
 * Resignations eligible to start a new final settlement — approved exit
 * (COMPLETED resignation + COMPLETED exit clearance) with no settlement
 * created yet. Backs the "Create Settlement" picker on the final-settlement
 * list page.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const resignations = await prisma.employeeResignation.findMany({
      where: {
        status: 'COMPLETED',
        exitClearance: { status: 'COMPLETED' },
        finalSettlement: null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, code: true } },
        exitClearance: true,
      },
      orderBy: { lastWorkingDate: 'asc' },
    });
    return Response.json(apiOk(resignations));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/final-settlement/eligible-resignations failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
