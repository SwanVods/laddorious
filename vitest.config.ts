import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.{ts,tsx}', 'art/test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
