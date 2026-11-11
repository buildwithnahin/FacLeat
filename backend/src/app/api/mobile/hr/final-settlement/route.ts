import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { FinalSettlementService } from '@/server/services/final-settlement.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const resignationId = req.nextUrl.searchParams.get('resignationId');
    const settlements = await FinalSettlementService.getSettlements(
      session,
      resignationId ? { resignationId } : undefined,
    );
    return Response.json(apiOk(settlements));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/final-settlement failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
