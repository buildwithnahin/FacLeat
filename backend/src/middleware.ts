import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This app is backend-only (no pages), so there is no cookie-session
// auth-guard here — every route under /api/** authorizes itself per-request
// (Bearer token via getMobileSession(), or NextAuth's own cookie handling
// for /api/auth/**). This middleware's only job is CORS: both the web app
// (Vercel, a different origin) and the Flutter app (native builds have no
// origin restriction; web/dev builds do) need these headers to call across
// origins.
//
// '*' would still be technically "safe" for pure Bearer-token routes (no
// cookies/credentials cross the origin boundary), but now that web/ is a
// real caller with a known dev origin, we allowlist explicitly instead of
// leaving every backend endpoint reachable (read included) from any web
// page in any browser tab. Set ALLOWED_ORIGINS to a comma-separated list of
// exact origins (e.g. "https://app.example.com,https://staging.example.com")
// for staging/production. Falls back to reflecting any origin (equivalent to
// '*', but via reflection so it still works with the Vary header below) when
// ALLOWED_ORIGINS is unset, which keeps local dev (web/ on localhost:3020,
// Flutter dev builds, etc.) working without configuration.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveAllowedOrigin(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (ALLOWED_ORIGINS.length === 0) {
    // No allowlist configured (dev/staging default) — reflect whatever
    // origin asked, or '*' for non-browser callers (native Flutter, curl)
    // that send no Origin header at all.
    return origin ?? '*';
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  // Non-browser callers (native mobile) send no Origin header — allow them
  // through even with an allowlist configured, since the allowlist only
  // meaningfully restricts browser-driven cross-origin calls.
  if (!origin) return '*';
  return '';
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(req);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  return headers;
}

export default function middleware(req: NextRequest) {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }
  const res = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
