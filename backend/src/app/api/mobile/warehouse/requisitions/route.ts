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
      branchId: sp.get('branchId') ?? undefined,
      destinationBranchId: sp.get('destinationBranchId') ?? undefined,
      sourceBranchId: sp.get('sourceBranchId') ?? undefined,
      direction: (sp.get('direction') as 'ALL' | 'INCOMING' | 'OUTGOING') ?? undefined,
      allBranches: sp.get('allBranches') === 'true',
      status: status ? (status as StockRequisitionStatus) : undefined,
    });
    return Response.json(
      apiOk(
        rows.map((row) => ({
          id: row.id,
          number: row.number,
          status: row.status,
          priority: row.priority,
          requiredDate: row.requiredDate.toISOString(),
          showroomWarehouse: row.showroomWarehouse,
          sourceWarehouse: row.sourceWarehouse,
          items: row.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.product?.name ?? '',
            sku: item.product?.sku ?? '',
            unit: item.unit,
            requestedQty: item.requestedQty.toString(),
            approvedQty: item.approvedQty.toString(),
            dispatchedQty: item.dispatchedQty.toString(),
            receivedQty: item.receivedQty.toString(),
          })),
          transfers: row.transfers.map((t) => ({
            id: t.id,
            number: t.number,
            status: t.status,
            vehicle: t.vehicle,
            driverName: t.driverName,
            driverPhone: t.driverPhone,
            gatePassNo: t.gatePassNo,
            trackingNo: t.trackingNo,
            updatedAt: t.updatedAt.toISOString(),
          })),
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
