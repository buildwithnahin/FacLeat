import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { signAccessToken, generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/server/auth/mobile-jwt';
import { apiError, apiOk } from '@/lib/api';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Invalid request'), { status: 400 });
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);
  const existing = await prisma.mobileRefreshToken.findUnique({ where: { tokenHash: hash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return Response.json(apiError('Refresh token is invalid or expired'), { status: 401 });
  }

  // Rotate: revoke the used token, issue a fresh pair.
  const { token: newRefreshToken, hash: newHash } = generateRefreshToken();

  await prisma.$transaction([
    prisma.mobileRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.mobileRefreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: newHash,
        deviceLabel: existing.deviceLabel,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    }),
  ]);

  const accessToken = await signAccessToken(existing.userId);

  return Response.json(
    apiOk({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    }),
  );
}
