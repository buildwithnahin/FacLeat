import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { headers } from 'next/headers';
import { prisma } from '@/server/db';
import { authConfig } from './config.edge';
import { recordAudit } from '@/server/audit/logger';
import { assertLoginAllowed, recordLoginFailure, clearLoginFailures } from './rate-limit';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
