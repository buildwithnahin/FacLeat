import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { assetService } from '@/server/services/asset.service';
import { assetDepreciateBulkSchema } from '@/server/validators/assets';

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = assetDepreciateBulkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const result = await assetService.depreciateBulk(session, {
      branchId: parsed.data.branchId || undefined,
      periodEnd: parsed.data.periodEnd,
    });
    return Response.json(apiOk(result));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/assets/depreciate-bulk failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
