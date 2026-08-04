import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sessions = await prisma.mobileRefreshToken.findMany({
    where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, deviceLabel: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json(apiOk(sessions));
}
