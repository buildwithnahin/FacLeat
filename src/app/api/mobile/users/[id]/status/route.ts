import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { userService } from '@/server/services/user.service';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) });

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const user = await userService.setStatus(session, id, parsed.data.status);
    return Response.json(apiOk(user));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PATCH /api/mobile/users/[id]/status failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
