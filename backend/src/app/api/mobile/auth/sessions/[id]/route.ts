import { NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  const result = await prisma.mobileRefreshToken.updateMany({
    where: { id, userId: session.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    return Response.json(apiError('Session not found'), { status: 404 });
  }

  return Response.json(apiOk({ revoked: true }));
}
