import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { recordAudit } from '@/server/audit/logger';
import { assertLoginAllowed, recordLoginFailure, clearLoginFailures } from '@/server/auth/rate-limit';
import { signAccessToken, generateRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/server/auth/mobile-jwt';
import { findQuickLoginAccount, getQuickLoginPassword } from '@/server/auth/quick-login-accounts';
import { apiError, apiOk } from '@/lib/api';

const quickLoginSchema = z.object({
  roleKey: z.string().min(1),
  deviceLabel: z.string().max(200).optional(),
});

/**
 * "Quick login" — one-click sign-in buttons on the login page (web + mobile)
 * for the 9 fixed demo/seed accounts. Deliberately unrestricted per explicit
 * product decision (no passphrase gate, all roles including Super Admin) —
 * see quick-login-accounts.ts for the full rationale and risk note.
 *
 * The client only ever sends a roleKey (e.g. "SUPER_ADMIN"), never a
 * password — the real password is resolved server-side from
 * QUICK_LOGIN_PASSWORD and checked exactly like a normal login, so it never
 * appears in client code, page source, or network payloads.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = quickLoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(apiError('Invalid request'), { status: 400 });
  }
  const { roleKey, deviceLabel } = parsed.data;

  const account = findQuickLoginAccount(roleKey);
  if (!account) {
    return Response.json(apiError('Unknown quick-login role'), { status: 400 });
  }
  const { email } = account;
  const password = getQuickLoginPassword();
  if (!password) {
    return Response.json(apiError('Quick login is not configured'), { status: 503 });
  }

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
    },
  });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = req.headers.get('user-agent');

  if (!user || user.status !== 'ACTIVE') {
    recordLoginFailure(email);
    return Response.json(apiError('Quick-login account unavailable'), { status: 401 });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    recordLoginFailure(email);
    return Response.json(apiError('Quick-login account unavailable'), { status: 401 });
  }

  clearLoginFailures(email);

  const accessToken = await signAccessToken(user.id);
  const { token: refreshToken, hash } = generateRefreshToken();
  await prisma.mobileRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      deviceLabel: deviceLabel ?? `quick-login:${roleKey}`,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  try {
    await recordAudit({
      actorId: user.id,
      branchId: user.defaultBranchId,
      module: 'auth',
      action: 'QUICK_LOGIN_SUCCESS',
      entityType: 'session',
      entityId: user.id,
      after: { email: user.email, roleKey, deviceLabel: deviceLabel ?? `quick-login:${roleKey}` },
      ip,
      userAgent,
    });
  } catch (error) {
    console.error('Quick login audit failed:', error);
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
