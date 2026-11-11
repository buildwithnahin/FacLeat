import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { productionIssueCreateSchema } from '@/server/validators/factory';

/** WIP Production Issue page (web `/factory/production-issue`). */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const branchId = session.activeBranchId ?? undefined;

    const [orders, warehouses, issues] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { branchId: branchId || undefined, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          materials: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      }),
      prisma.warehouse.findMany({
        where: { branchId: branchId || undefined, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, type: true },
      }),
      factoryWorkflowService.listProductionIssues(session, branchId),
    ]);

    return Response.json(apiOk({ orders, warehouses, issues }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/production-issue failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = productionIssueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const voucher = await factoryWorkflowService.createProductionIssue(session, parsed.data);
    return Response.json(apiOk(voucher), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/factory/production-issue failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
