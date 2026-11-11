import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  exitClearanceService,
  isEmployeeResignationTableMissingError,
  isResignationTableAvailable,
} from '@/server/services/resignations.service';
import { exitClearanceUpsertSchema } from '@/server/validators/resignations';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const available = await isResignationTableAvailable();
    if (!available) return Response.json(apiOk({ records: [], unavailable: true }));

    const sp = req.nextUrl.searchParams;
    const records = await exitClearanceService.list(session, {
      branchId: sp.get('branchId') ?? undefined,
      status: sp.get('status') ?? undefined,
      q: sp.get('q') ?? undefined,
    });
    return Response.json(apiOk({ records, unavailable: false }));
  } catch (err) {
    if (isEmployeeResignationTableMissingError(err)) return Response.json(apiOk({ records: [], unavailable: true }));
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/exit-clearance failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

/** Create/edit are the same upsert operation, matching the original `saveExitClearanceAction`. */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = exitClearanceUpsertSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const record = await exitClearanceService.upsert(session, parsed.data);
    return Response.json(apiOk(record));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/exit-clearance failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
