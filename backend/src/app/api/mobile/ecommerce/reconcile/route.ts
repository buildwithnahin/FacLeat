import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { ecommerceService } from '@/server/services/ecommerce.service';
import { reconcilePaymentsSchema } from '@/server/validators/ecommerce';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId =
    req.nextUrl.searchParams.get('branchId') ??
    session.activeBranchId ??
    session.defaultBranchId ??
    session.allowedBranchIds?.[0] ??
    undefined;
  try {
    const [channels, runs] = await Promise.all([
      ecommerceService.listChannels(session, branchId ?? undefined),
      ecommerceService.listReconciliationRuns(session, branchId ?? undefined),
    ]);
    return Response.json(apiOk({ channels, runs }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/ecommerce/reconcile failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = reconcilePaymentsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const run = await ecommerceService.reconcilePayments(session, parsed.data);
    return Response.json(apiOk(run));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/ecommerce/reconcile failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
