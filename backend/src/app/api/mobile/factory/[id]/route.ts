import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/server/db';
import { factoryService, getCostSummary } from '@/server/services/factory.service';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Production-order detail (web `/factory/[id]`): the order itself, the
 * warehouses in its branch (target list for "record output"), and the
 * server-computed cost summary — computed here rather than in web so the
 * costing formula (`getCostSummary`) stays in one place.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    const order = await factoryService.getById(session, id);
    const warehouses = await prisma.warehouse.findMany({
      where: { branchId: order.branchId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });

    const costSummary = getCostSummary({
      outputs: order.outputs,
      materials: order.materials,
      costEntries: order.costEntries,
      overheadRate: order.overheadRate,
      producedQty: order.producedQty,
    });

    return Response.json(apiOk({ order, warehouses, costSummary }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/factory/${id} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
