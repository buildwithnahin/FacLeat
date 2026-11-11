import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';
import { warehouseService } from '@/server/services/warehouse.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId');
  if (!branchId) return Response.json(apiError('branchId is required'), { status: 400 });

  try {
    const [showrooms, products] = await Promise.all([
      warehouseService.listActiveShowroomsForBranch(session, branchId),
      prisma.product.findMany({
        where: { isActive: true, type: 'FINISHED_GOOD' },
        orderBy: { name: 'asc' },
        select: { id: true, sku: true, name: true, unit: true },
      }),
    ]);

    return Response.json(
      apiOk({
        showrooms: showrooms.map((w) => ({ id: w.id, name: w.name, code: w.code })),
        products,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/requisitions/new-context failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
