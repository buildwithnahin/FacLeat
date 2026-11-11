import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { hashRefreshToken } from '@/server/auth/mobile-jwt';
import { apiError, apiOk } from '@/lib/api';

const logoutSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = logoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Invalid request'), { status: 400 });
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);
  await prisma.mobileRefreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return Response.json(apiOk({ loggedOut: true }));
}
