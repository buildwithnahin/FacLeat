import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { warehouseWorkflowService } from '@/server/services/warehouse-workflows.service';
import { customerReturnIntakeSchema } from '@/server/validators/warehouse-workflows';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
  try {
    const rows = await warehouseWorkflowService.listCustomerReturns(session, branchId);
    return Response.json(
      apiOk(
        rows.map((row) => ({
          id: row.id,
          number: row.number,
          returnDate: row.returnDate.toISOString(),
          customerName: row.customerName,
          sourceDocumentType: row.sourceDocumentType,
          sourceDocumentNumber: row.sourceDocumentNumber,
          status: row.status,
          warehouse: row.warehouse,
          items: row.items.map((item) => ({ id: item.id })),
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/returns failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = customerReturnIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const created = await warehouseWorkflowService.intakeCustomerReturn(session, parsed.data);
    return Response.json(apiOk({ id: created.id }), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/warehouse/returns failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
