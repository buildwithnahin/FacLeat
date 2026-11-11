import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import {
  isEmployeePromotionTableMissingError,
  isPromotionTableAvailable,
  promotionsService,
} from '@/server/services/promotions.service';
import { promotionCreateSchema } from '@/server/validators/promotions';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const available = await isPromotionTableAvailable();
    if (!available) return Response.json(apiOk({ records: [], unavailable: true }));

    const sp = req.nextUrl.searchParams;
    const records = await promotionsService.list(session, {
      branchId: sp.get('branchId') ?? undefined,
      employeeId: sp.get('employeeId') ?? undefined,
      status: sp.get('status') ?? undefined,
      promotionType: sp.get('promotionType') ?? undefined,
      q: sp.get('q') ?? undefined,
    });
    return Response.json(apiOk({ records, unavailable: false }));
  } catch (err) {
    if (isEmployeePromotionTableMissingError(err)) return Response.json(apiOk({ records: [], unavailable: true }));
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/promotions failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = promotionCreateSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const record = await promotionsService.create(session, parsed.data);
    return Response.json(apiOk(record));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/promotions failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
