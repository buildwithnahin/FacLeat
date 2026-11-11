import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { contractsService } from '@/server/services/contracts.service';
import { contractUpdateSchema } from '@/server/validators/contracts';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const contract = await contractsService.getById(session, id);
    return Response.json(apiOk(contract));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/contracts/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = contractUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const contract = await contractsService.update(session, parsed.data);
    return Response.json(apiOk(contract));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PUT /api/mobile/hr/contracts/[id] failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const deleted = await contractsService.delete(session, id);
    return Response.json(apiOk({ id: deleted.id, attachmentUrl: deleted.attachmentUrl }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('DELETE /api/mobile/hr/contracts/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
