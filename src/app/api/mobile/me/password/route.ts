import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { userService } from '@/server/services/user.service';
import { changeOwnPasswordSchema } from '@/server/validators/users';
import { ApiError } from '@/lib/errors';

export async function PATCH(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = changeOwnPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const result = await userService.changeOwnPassword(session, parsed.data);
    return Response.json(apiOk(result));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('PATCH /api/mobile/me/password failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
