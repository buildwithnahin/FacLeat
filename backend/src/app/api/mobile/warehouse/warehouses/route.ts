import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { warehouseService } from '@/server/services/warehouse.service';
import { warehouseCreateSchema } from '@/server/validators/warehouses';
import { ApiError } from '@/lib/errors';

/**
 * List shape mirrors warehouseService's various listX helpers behind one
 * query-param surface, since web/'s pages each need a different slice
 * (all, active-for-branch, active-showrooms[-for-branch]) and there is no
 * Prisma access on that side to filter client-side.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId') ?? undefined;
  const activeOnly = sp.get('activeOnly') === 'true';
  const showroomsOnly = sp.get('showrooms') === 'true';

  try {
    let warehouses;
    if (activeOnly && branchId && showroomsOnly) {
      warehouses = await warehouseService.listActiveShowroomsForBranch(session, branchId);
    } else if (activeOnly && branchId) {
      warehouses = await warehouseService.listActiveForBranch(session, branchId);
    } else if (showroomsOnly) {
      warehouses = await warehouseService.listActiveShowrooms(session);
    } else {
      warehouses = await warehouseService.listAll(session);
    }
    return Response.json(apiOk(warehouses));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/warehouses failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = warehouseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const warehouse = await warehouseService.create(session, parsed.data);
    return Response.json(apiOk(warehouse), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/warehouse/warehouses failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
