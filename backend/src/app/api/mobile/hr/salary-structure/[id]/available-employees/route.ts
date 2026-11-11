import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';

// Active employees available to assign to this structure. The `[id]` param
// isn't used to filter (any active employee can be assigned) — it just
// keeps the endpoint scoped under the structure's own route namespace.
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');
    const employees = await prisma.employee.findMany({
      where: { status: { in: ['ACTIVE'] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        code: true,
        department: true,
        designation: true,
      },
      orderBy: [{ firstName: 'asc' }],
    });
    return Response.json(apiOk(employees));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/salary-structure/[id]/available-employees failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}
