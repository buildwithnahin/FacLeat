import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { holidaysService } from '@/server/services/holidays.service';
import { holidayCreateSchema } from '@/server/validators/holidays';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const rawBranchId = req.nextUrl.searchParams.get('branchId');
    const branchId = rawBranchId && rawBranchId !== 'ALL' ? rawBranchId : undefined;
    const holidays = await holidaysService.listAll(session, branchId);
    return Response.json(
      apiOk(
        holidays.map((h) => ({
          id: h.id,
          name: h.name,
          code: h.code,
          startDate: h.startDate.toISOString(),
          endDate: h.endDate.toISOString(),
          type: h.type,
          branchId: h.branchId,
          isPaid: h.isPaid,
          status: h.status,
          description: h.description,
          branch: h.branch ? { name: h.branch.name, code: h.branch.code } : null,
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/holidays failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = holidayCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const holiday = await holidaysService.create(session, parsed.data);
    return Response.json(apiOk({ id: holiday.id }), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/holidays failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
