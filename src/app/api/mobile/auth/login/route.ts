import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/audit/logger';
import { assertLoginAllowed, recordLoginFailure, clearLoginFailures } from '@/server/auth/rate-limit';
import { signAccessToken, generateRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/server/auth/mobile-jwt';
import { apiError, apiOk } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceLabel: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Invalid request'), { status: 400 });
  }
  const { email, password, deviceLabel } = parsed.data;

  try {
    assertLoginAllowed(email);
  } catch (err) {
    return Response.json(apiError(err), { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      status: true,
      defaultBranchId: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent');

  if (!user || user.status !== 'ACTIVE') {
    recordLoginFailure(email);
    return Response.json(apiError('Invalid email or password'), { status: 401 });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    recordLoginFailure(email);
    return Response.json(apiError('Invalid email or password'), { status: 401 });
  }

  const isSuperAdmin = user.roles.some((ur) => ur.role.name.toLowerCase().includes('super admin'));
  if (!isSuperAdmin) {
    // Credentials were valid — this isn't a brute-force signal, so don't
    // feed the rate limiter, just refuse the app-level gate.
    return Response.json(apiError('This app is for system administrators only'), { status: 403 });
  }

  clearLoginFailures(email);

  const accessToken = await signAccessToken(user.id);
  const { token: refreshToken, hash } = generateRefreshToken();
  await prisma.mobileRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      deviceLabel: deviceLabel ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  try {
    await recordAudit({
      actorId: user.id,
      branchId: user.defaultBranchId,
      module: 'auth',
      action: 'MOBILE_LOGIN_SUCCESS',
      entityType: 'session',
      entityId: user.id,
      after: { email: user.email, deviceLabel: deviceLabel ?? null },
      ip,
      userAgent,
    });
  } catch (error) {
    console.error('Mobile login audit failed:', error);
  }

  return Response.json(
    apiOk({
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: { id: user.id, email: user.email, name: user.name },
    }),
  );
}
