import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { warehouseWorkflowService } from '@/server/services/warehouse-workflows.service';
import { damageReportSchema } from '@/server/validators/warehouse-workflows';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
  try {
    const rows = await warehouseWorkflowService.listDamageReports(session, branchId);
    return Response.json(
      apiOk(
        rows.map((row) => ({
          id: row.id,
          number: row.number,
          reportDate: row.reportDate.toISOString(),
          reason: row.reason,
          status: row.status,
          resolution: row.resolution,
          estimatedValue: row.estimatedValue.toString(),
          resolutionNote: row.resolutionNote,
          warehouse: row.warehouse,
          supplier: row.supplier ? { id: row.supplier.id, name: row.supplier.name } : null,
        })),
      ),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/damage-reports failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = damageReportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const created = await warehouseWorkflowService.reportDamage(session, parsed.data);
    return Response.json(apiOk({ id: created.id }), { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/warehouse/damage-reports failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
