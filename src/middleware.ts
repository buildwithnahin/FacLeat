import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/server/auth/config.edge';

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ['/login', '/forgot-password'];

const MOBILE_API_PREFIX = '/api/mobile';
// The Flutter app (native builds have no origin restriction, but the web
// build served from a different port during dev does) needs CORS headers
// on these Bearer-token routes. '*' is safe here since mobile auth never
// uses cookies/credentials — only an Authorization header.
const MOBILE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith(MOBILE_API_PREFIX)) {
    // These routes gate themselves per-request via getMobileSession()'s
    // Bearer-token check, so no cookie-session redirect here — just CORS.
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: MOBILE_CORS_HEADERS });
    }
    const res = NextResponse.next();
    for (const [key, value] of Object.entries(MOBILE_CORS_HEADERS)) {
      res.headers.set(key, value);
    }
    return res;
  }

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
  matcher: ['/((?!_next|api/auth|favicon.ico|.*\\..*).*)'],
};
