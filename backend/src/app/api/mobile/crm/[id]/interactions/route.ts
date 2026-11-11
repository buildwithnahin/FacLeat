import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { customerService } from '@/server/services/customer.service';
import { customerInteractionSchema } from '@/server/validators/crm';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = customerInteractionSchema.safeParse({ ...body, customerId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const interaction = await customerService.addInteraction(session, parsed.data);
    return Response.json(apiOk(interaction));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/crm/${id}/interactions failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
