import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { warehouseWorkflowService } from '@/server/services/warehouse-workflows.service';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const entry = await warehouseWorkflowService.getCustomerReturnById(session, id);
    return Response.json(
      apiOk({
        id: entry.id,
        number: entry.number,
        status: entry.status,
        customerName: entry.customerName,
        sourceDocumentType: entry.sourceDocumentType,
        sourceDocumentNumber: entry.sourceDocumentNumber,
        financeAction: entry.financeAction,
        financeNote: entry.financeNote,
        inspectionNote: entry.inspectionNote,
        warehouse: entry.warehouse,
        inspectionWarehouse: entry.inspectionWarehouse,
        items: entry.items.map((item) => ({
          id: item.id,
          quantity: item.quantity.toString(),
          note: item.note,
          disposition: item.disposition,
          productId: item.productId,
          product: {
            sku: item.product.sku,
            name: item.product.name,
            unit: item.product.unit,
            costPrice: item.product.costPrice.toString(),
          },
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/returns/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
