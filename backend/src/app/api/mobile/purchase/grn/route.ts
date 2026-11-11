import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { purchaseService } from '@/server/services/purchase.service';
import { grnCreateSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const status = req.nextUrl.searchParams.get('status') ?? undefined;
  const supplierId = req.nextUrl.searchParams.get('supplierId') ?? undefined;
  const search = req.nextUrl.searchParams.get('search') ?? req.nextUrl.searchParams.get('q') ?? undefined;
  const branchId =
    req.nextUrl.searchParams.get('branchId') ??
    session.activeBranchId ??
    session.defaultBranchId ??
    session.allowedBranchIds?.[0] ??
    undefined;

  try {
    const data = await purchaseService.listGrns(session, { status, supplierId, branchId, search });
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/purchase/grn failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = grnCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(
      apiError(parsed.error.issues[0]?.message ?? 'Validation failed', parsed.error.flatten()),
      { status: 422 },
    );
  }

  try {
    const data = await purchaseService.createGrn(session, parsed.data);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/purchase/grn failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
