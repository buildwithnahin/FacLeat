import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockRequisitionService } from '@/server/services/stock-requisition.service';
import { stockRequisitionCreateSchema } from '@/server/validators/stock-requisitions';
import { ApiError } from '@/lib/errors';
import type { StockRequisitionStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  try {
    const rows = await stockRequisitionService.listRequisitions(session, {
      destinationBranchId: sp.get('destinationBranchId') ?? undefined,
      sourceBranchId: sp.get('sourceBranchId') ?? undefined,
      status: status ? (status as StockRequisitionStatus) : undefined,
    });
    return Response.json(
      apiOk(
        rows.map((row) => ({
          id: row.id,
          number: row.number,
          status: row.status,
          requiredDate: row.requiredDate.toISOString(),
          showroomWarehouse: row.showroomWarehouse,
          sourceWarehouse: row.sourceWarehouse,
          items: row.items.map((item) => ({ id: item.id })),
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/requisitions failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = stockRequisitionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const created = await stockRequisitionService.create(session, parsed.data);
    return Response.json(apiOk({ id: created.id }), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/warehouse/requisitions failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
