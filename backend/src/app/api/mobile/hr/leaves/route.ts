import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { leavesService } from '@/server/services/leaves.service';
import { leaveApplicationSchema } from '@/server/validators/leaves';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const statusParam = sp.get('status');

  const filters = {
    status: statusParam ? statusParam.split(',').filter(Boolean) : undefined,
    branchId: sp.get('branchId') ?? undefined,
    employeeId: sp.get('employeeId') ?? undefined,
    department: sp.get('department') ?? undefined,
    type: sp.get('type') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
    q: sp.get('q') ?? undefined,
  };

  try {
    const data = await leavesService.list(session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/leaves failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = leaveApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await leavesService.apply(session, parsed.data);
    return Response.json(apiOk(data), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/leaves failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
