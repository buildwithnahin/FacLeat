import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { branchService } from '@/server/services/branch.service';
import { branchUpdateSchema } from '@/server/validators/branches';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    const branch = await branchService.getById(session, id);
    return Response.json(apiOk(branch));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/branches/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = branchUpdateSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const branch = await branchService.update(session, parsed.data);
    return Response.json(apiOk(branch));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PATCH /api/mobile/branches/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
