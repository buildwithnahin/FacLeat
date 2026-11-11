import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { tradeService } from '@/server/services/trade.service';
import { updateLCStatusSchema } from '@/server/validators/trade';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateLCStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await tradeService.updateLCStatus(session, parsed.data);
    return Response.json(apiOk(data, 'LC status updated'));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/trade/lc/status failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
