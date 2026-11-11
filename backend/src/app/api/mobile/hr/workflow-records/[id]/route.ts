import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError, NotFoundError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { hrService } from '@/server/services/hr.service';
import { hrWorkflowRecordUpdateSchema } from '@/server/validators/hr';

type RouteParams = { params: Promise<{ id: string }> };

/** Single-record lookup — used by pages resolving a candidate/offer's raw metadata by id. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    await authorize(session, 'hr:read');
    const row = await prisma.hrWorkflowRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Workflow record not found');
    return Response.json(apiOk(row));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/workflow-records/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = hrWorkflowRecordUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    await hrService.updateWorkflowRecord(session, parsed.data);
    return Response.json(apiOk({ id }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PUT /api/mobile/hr/workflow-records/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 400 });
  }
}
