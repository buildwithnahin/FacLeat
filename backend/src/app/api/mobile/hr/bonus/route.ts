import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { BonusService } from '@/server/services/bonus.service';
import { bonusFormSchema } from '@/server/validators/bonus';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const bonusType = sp.get('bonusType');
    const q = sp.get('q');

    const where: Prisma.BonusWhereInput = {};
    if (status) where.status = status as Prisma.BonusWhereInput['status'];
    if (bonusType) where.bonusType = bonusType as Prisma.BonusWhereInput['bonusType'];
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }

    const bonuses = await BonusService.getBonuses(session, where);
    return Response.json(apiOk(bonuses));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/bonus failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const body = await req.json();
    const parsed = bonusFormSchema.safeParse(body);
    if (!parsed.success) return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });

    const bonus = await BonusService.createBonus(session, parsed.data);
    return Response.json(apiOk(bonus));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/bonus failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
