import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockRequisitionService } from '@/server/services/stock-requisition.service';
import { stockTransferReceiveSchema } from '@/server/validators/stock-requisitions';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = stockTransferReceiveSchema.safeParse({ ...(body ?? {}), transferId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const updated = await stockRequisitionService.receiveTransfer(session, parsed.data);
    return Response.json(apiOk({ id: updated.id, requisitionId: updated.requisitionId }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/warehouse/transfers/[id]/receive failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
