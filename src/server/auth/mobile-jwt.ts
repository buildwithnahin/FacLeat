import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'crypto';

/**
 * Token pair for the Super-Admin-only mobile app.
 *
 * Access tokens are short-lived JWTs carrying only the user id — never
 * roles/permissions — so a stale token can't grant stale access; every
 * request re-derives permissions fresh from the DB (mobile-session.ts),
 * matching the same "no permissions in the token" rule the web session
 * already follows (see session.ts).
 *
 * Refresh tokens are opaque random bytes, not JWTs. Only their SHA-256
 * hash is ever persisted (MobileRefreshToken.tokenHash) or compared —
 * the raw value exists only in transit to the client.
 */

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
