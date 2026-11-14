import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { shiftsService } from '@/server/services/shifts.service';
import { shiftCreateSchema } from '@/server/validators/shifts';

/**
 * Full shift list — backs the `hr/shifts` list page (status, shiftType,
 * min-present/half-day minutes, weeklyOffDays, employeeCount) and doubles
 * as the shift-picker lookup used by the contracts/joining forms, which
 * only read a subset of these fields.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const rawBranchId = req.nextUrl.searchParams.get('branchId');
    const branchId = rawBranchId && rawBranchId !== 'ALL' ? rawBranchId : undefined;
    const shifts = await shiftsService.listAll(session, branchId);
    return Response.json(
      apiOk(
        shifts.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          status: s.status,
          shiftType: s.shiftType,
          startTime: s.startTime,
          endTime: s.endTime,
          minPresentMinutes: s.minPresentMinutes,
          minHalfDayMinutes: s.minHalfDayMinutes,
          weeklyOffDays: s.weeklyOffDays,
          branchId: s.branchId,
          branch: { code: s.branch.code, name: s.branch.name },
          employeeCount: s._count.employees,
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/shifts failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = shiftCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const shift = await shiftsService.create(session, parsed.data);
    return Response.json(apiOk({ id: shift.id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/shifts failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
