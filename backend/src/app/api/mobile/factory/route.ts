import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { factoryService } from '@/server/services/factory.service';
import { productionOrderCreateSchema } from '@/server/validators/factory';

/**
 * List + summary for the production-orders index (web `/factory` page).
 * Combined into one round trip since the page always needs both.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') ?? undefined;
  const search = sp.get('search') ?? undefined;
  const branchId = sp.get('branchId') ?? session.activeBranchId ?? undefined;

  try {
    const [orders, summary] = await Promise.all([
      factoryService.list(session, { branchId, status, search }),
      factoryService.summary(session, branchId),
    ]);
    return Response.json(apiOk({ orders, summary }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = productionOrderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const order = await factoryService.create(session, parsed.data);
    return Response.json(apiOk(order), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/factory failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
