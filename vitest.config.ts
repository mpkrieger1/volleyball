import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', '**/src/**/*.test.ts'],
    exclude: ['node_modules', 'tests/e2e/**', '**/dist/**', 'release/**', 'resources/**'],
    environmentMatchGlobs: [
      ['tests/unit/**/*.test.tsx', 'jsdom'],
      ['app/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['shared/src/**', 'main/src/**', 'workers/src/**', 'app/src/**'],
    },
  },
  resolve: {
    // Sprint 19 hotfix + Sprint 21 fix: use regex aliases so the
    // `@vcd/shared/seed` sub-path matches EXACTLY and doesn't shadow
    // deeper paths like `@vcd/shared/seed/leagueSeed` (used by seed
    // unit tests). Plain string aliases would greedily prefix-match
    // and produce wrong resolutions.
    alias: [
      {
        find: /^@vcd\/shared\/seed$/,
        replacement: path.resolve(__dirname, 'shared/src/seed/leagueSeed'),
      },
      {
        find: /^@vcd\/shared\/sim\/live\/state$/,
        replacement: path.resolve(__dirname, 'shared/src/sim/live/state'),
      },
      {
        find: /^@vcd\/shared(\/.*)?$/,
        replacement: path.resolve(__dirname, 'shared/src') + '$1',
      },
    ],
  },
});
