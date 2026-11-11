import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { confirmationsService, isEmployeeConfirmationTableMissingError } from '@/server/services/confirmations.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
    const counts = await confirmationsService.countByStatus(session, branchId);
    return Response.json(apiOk(counts));
  } catch (err) {
    if (isEmployeeConfirmationTableMissingError(err)) return Response.json(apiOk({}));
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/confirmations/counts failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
