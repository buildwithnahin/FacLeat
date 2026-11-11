import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { BonusService } from '@/server/services/bonus.service';
import { bonusApprovalSchema } from '@/server/validators/bonus';
import type { BonusStatus } from '@prisma/client';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = bonusApprovalSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const bonus = await BonusService.updateStatus(session, id, parsed.data.status as BonusStatus, parsed.data.remarks);
    return Response.json(apiOk(bonus));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/bonus/[id]/status failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
