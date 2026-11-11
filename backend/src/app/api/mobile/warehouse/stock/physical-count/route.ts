import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockService } from '@/server/services/stock.service';
import { physicalCountSchema } from '@/server/validators/stock';
import { ApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = physicalCountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const result = await stockService.postPhysicalCount(session, parsed.data);
    return Response.json(apiOk(result), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/warehouse/stock/physical-count failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
