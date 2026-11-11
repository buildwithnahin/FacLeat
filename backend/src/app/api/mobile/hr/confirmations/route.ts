import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  confirmationsService,
  isConfirmationTableAvailable,
  isEmployeeConfirmationTableMissingError,
} from '@/server/services/confirmations.service';
import { confirmationCreateSchema } from '@/server/validators/confirmations';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const available = await isConfirmationTableAvailable();
    if (!available) return Response.json(apiOk({ records: [], unavailable: true }));

    const sp = req.nextUrl.searchParams;
    const records = await confirmationsService.list(session, {
      branchId: sp.get('branchId') ?? undefined,
      employeeId: sp.get('employeeId') ?? undefined,
      status: sp.get('status') ?? undefined,
      confirmationType: sp.get('confirmationType') ?? undefined,
      q: sp.get('q') ?? undefined,
    });
    return Response.json(apiOk({ records, unavailable: false }));
  } catch (err) {
    if (isEmployeeConfirmationTableMissingError(err)) return Response.json(apiOk({ records: [], unavailable: true }));
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/confirmations failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = confirmationCreateSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const record = await confirmationsService.create(session, parsed.data);
    return Response.json(apiOk(record));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/confirmations failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
