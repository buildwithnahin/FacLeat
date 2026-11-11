import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { shiftsService } from '@/server/services/shifts.service';
import { shiftUpdateSchema } from '@/server/validators/shifts';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  try {
    const s = await shiftsService.getById(session, id);
    return Response.json(
      apiOk({
        id: s.id,
        branchId: s.branchId,
        name: s.name,
        code: s.code,
        status: s.status,
        description: s.description,
        shiftType: s.shiftType,
        startTime: s.startTime,
        endTime: s.endTime,
        breakStart: s.breakStart,
        breakEnd: s.breakEnd,
        lateGraceMinutes: s.lateGraceMinutes,
        earlyExitGraceMinutes: s.earlyExitGraceMinutes,
        minPresentMinutes: s.minPresentMinutes,
        minHalfDayMinutes: s.minHalfDayMinutes,
        absentBelowMinutes: s.absentBelowMinutes,
        overtimeAllowed: s.overtimeAllowed,
        otStartsAfter: s.otStartsAfter,
        minOtMinutes: s.minOtMinutes,
        maxOtMinutesPerDay: s.maxOtMinutesPerDay,
        weeklyOffDays: Array.isArray(s.weeklyOffDays) ? s.weeklyOffDays.map(String) : [],
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/shifts/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = shiftUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    await shiftsService.update(session, parsed.data);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PUT /api/mobile/hr/shifts/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
