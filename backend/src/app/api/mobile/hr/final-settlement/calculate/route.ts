import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { FinalSettlementService } from '@/server/services/final-settlement.service';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const { resignationId } = await req.json();
    if (!resignationId) return Response.json(apiError('resignationId is required'), { status: 422 });

    const settlement = await FinalSettlementService.calculateSettlement(session, resignationId);
    return Response.json(apiOk(settlement));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/final-settlement/calculate failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
