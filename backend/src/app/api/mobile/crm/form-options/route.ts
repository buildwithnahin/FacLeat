import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';

/**
 * Branch + category pickers shared by both the "new customer" and "edit
 * customer" forms — mirrors the two direct Prisma calls each of those root
 * pages made (src/app/(app)/crm/new/page.tsx, src/app/(app)/crm/[id]/edit/page.tsx).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const [branches, categories] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.customerCategory.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    return Response.json(apiOk({ branches, categories }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/crm/form-options failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
