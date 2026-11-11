import type { NextConfig } from 'next';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

// The backend API's origin — needed in connect-src below because it's not
// same-origin anymore (see .env.example). Client-side code that talks to it
// directly (currently just NotificationBell's EventSource for live SSE
// push, since a plain EventSource can't be proxied through a Route Handler
// the way regular fetches are) would otherwise be silently blocked by CSP.
const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  `connect-src 'self' https: ${BACKEND_URL}`,
].join('; ');

const nextConfig: NextConfig = {
  distDir: isDev ? '.next-dev' : '.next',
  reactStrictMode: true,
  // Scope Next.js to this project directory. Without this, Next.js walks up
  // looking for a workspace root and finds the monorepo's root pnpm-lock.yaml
  // as well as this project's own package-lock.json, and warns about
  // "multiple lockfiles" on every dev server start. Both lockfiles are
  // intentionally kept (see CLAUDE.md migration notes), so we silence the
  // warning by pinning the root explicitly instead of deleting either file.
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    // cPanel/CloudLinux (Hostever) enforces a per-account LVE process/fork
    // limit — see backend/next.config.ts for the full explanation. Same
    // mitigation applied here.
    workerThreads: false,
    cpus: 1,
  },
  // Local-Windows-only build workaround — see backend/next.config.ts.
  outputFileTracingExcludes: {
    '*': ['C:/Users/**', 'C:\\\\Users\\\\**'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
