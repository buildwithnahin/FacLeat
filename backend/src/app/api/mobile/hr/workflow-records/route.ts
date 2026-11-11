import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { hrWorkflowRecordCreateSchema } from '@/server/validators/hr';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const section = sp.get('section');
    if (!section) return Response.json(apiError('section is required'), { status: 422 });
    const rows = await hrService.listWorkflowRecords(session, {
      section,
      branchId: sp.get('branchId') ?? undefined,
    });
    return Response.json(apiOk(rows));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/workflow-records failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = hrWorkflowRecordCreateSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const row = await hrService.createWorkflowRecord(session, parsed.data);
    return Response.json(apiOk(row));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/workflow-records failed', err);
    return Response.json(apiError('Internal server error'), { status: 400 });
  }
}
