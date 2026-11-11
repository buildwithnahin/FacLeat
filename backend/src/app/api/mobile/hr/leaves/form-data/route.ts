import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { leaveTypesService } from '@/server/services/leave-types.service';

/**
 * Reference data shared by the Leave Application page (New Leave Form +
 * registry) and the Leave Approval filter bar — a superset of employee
 * fields so one round trip serves both pages instead of duplicating the
 * same active-employee query per screen.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'hr:read');

    const [employeesResult, branches, leaveTypes] = await Promise.all([
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          department: true,
          designation: true,
          joinedAt: true,
          employmentType: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: [{ firstName: 'asc' }],
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      leaveTypesService.listActive(session),
    ]);

    const employees = employeesResult.map((emp) => ({
      id: emp.id,
      code: emp.code,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      designation: emp.designation,
      joiningDate: emp.joinedAt.toISOString(),
      employmentType: emp.employmentType,
      branch: emp.branch,
    }));

    return Response.json(apiOk({ employees, branches, leaveTypes }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leaves/form-data failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
