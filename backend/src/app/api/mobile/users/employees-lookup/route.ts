import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { ApiError } from '@/lib/errors';

/**
 * Employee options for the user create/edit form's "Employee" select. Scoped
 * narrowly to what that form needs (active employees with no user account
 * yet, or — when editing — the employee already linked to that user) rather
 * than a general employee-directory endpoint; the full HR employee module
 * isn't migrated yet.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'users:write');
    const excludeUserId = req.nextUrl.searchParams.get('excludeUserId');

    const employees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        OR: excludeUserId ? [{ user: null }, { user: { id: excludeUserId } }] : [{ user: null }],
        ...(session.activeCompanyId
          ? { branch: { companyId: session.activeCompanyId } }
          : {}),
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        designation: true,
        department: true,
        phone: true,
      },
    });

    return Response.json(apiOk(employees));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/users/employees-lookup failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
