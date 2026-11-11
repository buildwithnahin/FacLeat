import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { stockRequisitionService } from '@/server/services/stock-requisition.service';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId');
  if (!branchId) return Response.json(apiError('branchId is required'), { status: 400 });

  try {
    const rows = await stockRequisitionService.listReceiptTransfers(session, branchId);
    return Response.json(
      apiOk(
        rows.map((row) => ({
          id: row.id,
          number: row.number,
          status: row.status,
          requisition: { id: row.requisition.id, number: row.requisition.number },
          fromWarehouse: row.fromWarehouse,
          toWarehouse: row.toWarehouse,
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/requisitions/receipt-transfers failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
