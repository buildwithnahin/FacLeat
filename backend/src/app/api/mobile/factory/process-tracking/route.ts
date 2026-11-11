import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { processTrackingCreateSchema } from '@/server/validators/factory';

/**
 * WIP Process Tracking page (web `/factory/process-tracking`): active/planned
 * orders with their stages (for the form's selects), active employees (as
 * operator options), and the tracking record history — all in one call,
 * mirroring the root page.tsx's `Promise.all`.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'factory:read');
    const branchId = session.activeBranchId ?? undefined;

    const [orders, employees, trackings] = await Promise.all([
      prisma.productionOrder.findMany({
        where: { branchId: branchId || undefined, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          stages: { orderBy: { sequence: 'asc' } },
        },
      }),
      prisma.employee.findMany({
        where: { branchId: branchId || undefined, status: 'ACTIVE' },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, firstName: true, lastName: true },
      }),
      factoryWorkflowService.listProcessTrackings(session, branchId),
    ]);

    return Response.json(apiOk({ orders, employees, trackings }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/factory/process-tracking failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = processTrackingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const tracking = await factoryWorkflowService.saveProcessTracking(session, parsed.data);
    return Response.json(apiOk(tracking), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/factory/process-tracking failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
