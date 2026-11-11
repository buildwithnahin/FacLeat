import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { corporateService } from '@/server/services/corporate-sales.service';
import { convertQuoteSchema } from '@/server/validators/corporate-sales';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = convertQuoteSchema.safeParse({ ...(body ?? {}), quoteId: id });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const order = await corporateService.convertQuoteToOrder(session, parsed.data);
    return Response.json(apiOk(order));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`POST /api/mobile/corporate-sales/quotes/${id}/convert failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
