import type { NextAuthConfig } from 'next-auth';

// Edge-compatible NextAuth config used only by middleware.ts for the
// cookie-session presence check (redirect-to-login). No providers here —
// providers execute in the main config.ts (Node runtime, since it fetches
// the backend), this one only needs to decode the JWT cookie fast.
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
