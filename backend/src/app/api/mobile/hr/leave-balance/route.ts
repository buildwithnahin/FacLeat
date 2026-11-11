import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { leaveBalanceService } from '@/server/services/leave-balance.service';
import { leaveTypesService } from '@/server/services/leave-types.service';

/**
 * Bundles everything the Leave Balance list page needs (filters reference
 * data + employee summaries + recent adjustment log) into one round trip,
 * mirroring the Promise.all the old direct-Prisma page ran server-side.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const currentYear = new Date().getUTCFullYear();
  const filters = {
    q: sp.get('q') || undefined,
    year: Number(sp.get('year') || currentYear),
    branchId: sp.get('branchId') || undefined,
    department: sp.get('department') || undefined,
    designation: sp.get('designation') || undefined,
    employeeId: sp.get('employeeId') || undefined,
    leaveType: sp.get('leaveType') || undefined,
    balanceStatus: sp.get('balanceStatus') || undefined,
  };

  try {
    await authorize(session, 'hr:read');

    const [branches, employees, leaveTypes, summaries, adjustments] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        select: { id: true, code: true, firstName: true, lastName: true, department: true, designation: true },
        orderBy: [{ code: 'asc' }],
      }),
      leaveTypesService.listActive(session),
      leaveBalanceService.listEmployeeSummaries(session, filters),
      leaveBalanceService.listAdjustmentHistory(session, {
        year: filters.year,
        branchId: filters.branchId,
        employeeId: filters.employeeId,
        leaveType: filters.leaveType,
      }),
    ]);

    return Response.json(apiOk({ branches, employees, leaveTypes, summaries, adjustments }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leave-balance failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
