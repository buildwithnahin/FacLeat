import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

// web/ has no direct database access — that's the whole point of the
// backend/web split. Login goes through `POST /api/mobile/auth/web-login` —
// a sibling of the Flutter app's `/api/mobile/auth/login` that issues the
// same Bearer token pair but WITHOUT that endpoint's super-admin-only gate
// (the mobile app is intentionally scoped to Super Admin; web/ is the
// general ERP frontend for every role). NextAuth's job here is just to
// carry that token pair inside its own encrypted session cookie so this
// app's Server Components/Actions can attach it as
// `Authorization: Bearer <token>` on every backend/ API call (see
// `@/lib/backend-client`).
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface BackendLoginUser {
  id: string;
  email: string;
  name: string;
  backendAccessToken: string;
  backendRefreshToken: string;
  backendAccessTokenExpiresAt: number;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // Set instead of email/password by the quick-login buttons — see
        // login-form.tsx and quick-login-accounts.ts (backend). The real
        // password for the selected role is resolved and checked entirely
        // server-side by the backend's quick-login route; it's never sent
        // here or exposed to the client.
        quickRole: { label: 'Quick Role', type: 'text' },
      },
      async authorize(raw) {
        const quickRole = typeof raw?.quickRole === 'string' && raw.quickRole ? raw.quickRole : undefined;

        let res: Response;
        if (quickRole) {
          res = await fetch(`${BACKEND_URL}/api/mobile/auth/quick-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleKey: quickRole, deviceLabel: 'web-quick' }),
            cache: 'no-store',
          });
        } else {
          const email = typeof raw?.email === 'string' ? raw.email : undefined;
          const password = typeof raw?.password === 'string' ? raw.password : undefined;
          if (!email || !password) return null;

          res = await fetch(`${BACKEND_URL}/api/mobile/auth/web-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, deviceLabel: 'web' }),
            cache: 'no-store',
          });
        }
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return null;

        const user: BackendLoginUser = {
          id: json.data.user.id,
          email: json.data.user.email,
          name: json.data.user.name,
          backendAccessToken: json.data.accessToken,
          backendRefreshToken: json.data.refreshToken,
          // accessToken's `expiresIn` is in seconds (900 = 15min, matches
          // the mobile app's contract) — store the absolute expiry so the
          // backend-client can tell a near-expired token apart from a fresh
          // one without re-decoding the JWT itself.
          backendAccessTokenExpiresAt: Date.now() + json.data.expiresIn * 1000,
        };
        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as BackendLoginUser;
        token.backendAccessToken = u.backendAccessToken;
        token.backendRefreshToken = u.backendRefreshToken;
        token.backendAccessTokenExpiresAt = u.backendAccessTokenExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      session.backendAccessToken = token.backendAccessToken as string;
      session.backendRefreshToken = token.backendRefreshToken as string;
      session.backendAccessTokenExpiresAt = token.backendAccessTokenExpiresAt as number;
      return session;
    },
  },
});
