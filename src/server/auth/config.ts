import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { authConfig } from './config.edge';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function assertLoginAllowed(email: string) {
  const key = email.toLowerCase();
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  if (state.count >= LOGIN_MAX_ATTEMPTS) {
    throw new Error('Too many login attempts. Try again later.');
  }
}

function recordLoginFailure(email: string) {
  const key = email.toLowerCase();
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || state.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  state.count += 1;
}

function clearLoginFailures(email: string) {
  loginAttempts.delete(email.toLowerCase());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        assertLoginAllowed(parsed.data.email);

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, passwordHash: true, status: true, defaultBranchId: true },
        });

        if (!user || user.status !== 'ACTIVE') {
          recordLoginFailure(parsed.data.email);
          return null;
        }
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          recordLoginFailure(parsed.data.email);
          return null;
        }

        clearLoginFailures(parsed.data.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          activeBranchId: user.defaultBranchId ?? null,
        };
      },
    }),
  ],
});
