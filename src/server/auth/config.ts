import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { headers } from 'next/headers';
import { prisma } from '@/server/db';
import { authConfig } from './config.edge';
import { recordAudit } from '@/server/audit/logger';

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

async function getRequestAuditMeta() {
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get('x-forwarded-for');
    return {
      ip: forwardedFor?.split(',')[0]?.trim() ?? null,
      userAgent: headerStore.get('user-agent'),
    };
  } catch {
    return {
      ip: null,
      userAgent: null,
    };
  }
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
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            status: true,
            defaultBranchId: true,
            defaultCompanyId: true,
          },
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
        const auditMeta = await getRequestAuditMeta();
        try {
          await recordAudit({
            actorId: user.id,
            branchId: user.defaultBranchId ?? null,
            module: 'auth',
            action: 'LOGIN_SUCCESS',
            entityType: 'session',
            entityId: user.id,
            after: {
              email: user.email,
            },
            ip: auditMeta.ip,
            userAgent: auditMeta.userAgent,
          });
        } catch (error) {
          console.error('Login audit failed:', error);
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          defaultBranchId: user.defaultBranchId ?? null,
          activeBranchId: user.defaultBranchId ?? null,
          defaultCompanyId: user.defaultCompanyId ?? null,
          activeCompanyId: user.defaultCompanyId ?? null,
        };
      },
    }),
  ],
});
