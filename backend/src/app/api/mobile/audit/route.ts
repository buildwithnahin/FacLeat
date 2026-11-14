import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { auditService } from '@/server/services/audit.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const limitParam = sp.get('limit');
  const offsetParam = sp.get('offset');

  const filters = {
    branchId: sp.get('branchId') ?? undefined,
    module: sp.get('module') ?? undefined,
    action: sp.get('action') ?? undefined,
    entityType: sp.get('entityType') ?? undefined,
    actorId: sp.get('actorId') ?? undefined,
    search: sp.get('search') ?? undefined,
    from: fromParam && !isNaN(new Date(fromParam).getTime()) ? new Date(fromParam) : undefined,
    to: toParam && !isNaN(new Date(toParam).getTime()) ? new Date(toParam) : undefined,
    limit: limitParam ? Number(limitParam) : undefined,
    offset: offsetParam ? Number(offsetParam) : undefined,
  };

  try {
    const data = await auditService.list(session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/audit failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
