import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/server/auth/config.edge';

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ['/login', '/forgot-password'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // api/mobile is excluded here, not via PUBLIC_PREFIXES: those mobile
  // routes are never "public" — they gate themselves per-request via
  // getMobileSession()'s Bearer-token check, so the cookie-session
  // middleware must not intercept them at all.
  matcher: ['/((?!_next|api/auth|api/mobile|favicon.ico|.*\\..*).*)'],
};
