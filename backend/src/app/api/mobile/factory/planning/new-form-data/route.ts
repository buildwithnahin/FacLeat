import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

/** Lookup data for the "New production plan" form (web `/factory/planning/new`). */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const [branches, products] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.product.findMany({
        where: { isActive: true, type: { in: ['FINISHED_GOOD', 'WORK_IN_PROGRESS'] } },
        orderBy: { name: 'asc' },
        select: { id: true, sku: true, name: true, unit: true },
      }),
    ]);
    return Response.json(apiOk({ branches, products }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/planning/new-form-data failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
