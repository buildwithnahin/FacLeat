import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Scope Next.js to this project directory. Without this, Next.js walks up
  // looking for a workspace root and finds the monorepo's root pnpm-lock.yaml
  // as well as this project's own package-lock.json, and warns about
  // "multiple lockfiles" on every dev server start. Both lockfiles are
  // intentionally kept (see CLAUDE.md migration notes), so we silence the
  // warning by pinning the root explicitly instead of deleting either file.
  outputFileTracingRoot: __dirname,
  // Render's Free instance has 512 MB of RAM, and `next build`'s "Linting and
  // checking validity of types" step is the memory peak — the build gets
  // killed right there with no error. `npm run typecheck` passes locally, so
  // skip the duplicate check on Render only (Render sets RENDER=true); every
  // other environment keeps the full check.
  ...(process.env.RENDER === 'true'
    ? { typescript: { ignoreBuildErrors: true }, eslint: { ignoreDuringBuilds: true } }
    : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
    ...(process.env.CPANEL === 'true'
      ? {
          workerThreads: false,
          cpus: 1,
        }
      : {}),
  },
  // Local-Windows-only build workaround: Next's output-file-tracing walk
  // hits EPERM on Windows's protected NTFS junctions under the user
  // profile (Cookies, Application Data) for reasons unrelated to this
  // project (which lives entirely outside C:\Users). Harmless to exclude
  // broadly since nothing the app actually needs lives there; on Linux
  // (Render, cPanel) these paths simply don't exist, so this is a no-op
  // there.
  outputFileTracingExcludes: {
    '*': ['C:/Users/**', 'C:\\\\Users\\\\**'],
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@prisma/client': path.resolve('./src/generated/prisma'),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      '@prisma/client': './src/generated/prisma',
    },
  },
};

export default nextConfig;
