import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@prisma/client': path.resolve(__dirname, 'src/generated/prisma'),
      'server-only': path.resolve(__dirname, 'src/test/server-only.ts'),
    },
  },
});
