import 'server-only';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from './mobile-jwt';
import { buildSessionForUser, type AppSession } from './session';

/**
 * Bearer-token equivalent of getSession() for the Super-Admin-only mobile
 * app. Builds the exact same AppSession shape from the DB, fresh per
 * request, so every existing session-aware service function works
 * unchanged for mobile callers.
 */
export async function getMobileSession(req: NextRequest): Promise<AppSession | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const userId = await verifyAccessToken(token);
  if (!userId) return null;

  return buildSessionForUser(userId);
}

export function isSuperAdminSession(session: AppSession | null): boolean {
  if (!session) return false;
  return session.roles.some((role) => role.toLowerCase().includes('super admin'));
}
