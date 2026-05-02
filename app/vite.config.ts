import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// base: './' makes built assets resolve via relative paths so Electron can load
// them via file:// in packaged builds.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', sourcemap: true, emptyOutDir: true },
  resolve: {
    // Sprint 19 hotfix + Sprint 21 fix: regex aliases. `@vcd/shared/seed`
    // matches EXACTLY so deeper paths like `@vcd/shared/seed/leagueSeed`
    // route via the catch-all to source. `seedLeagueInto` imports
    // `node:fs` and must NEVER be pulled into the renderer bundle; the
    // renderer doesn't import these paths but the alias is a safety net.
    alias: [
      {
        find: /^@vcd\/shared\/seed$/,
        replacement: path.resolve(__dirname, '../shared/src/seed/leagueSeed'),
      },
      {
        find: /^@vcd\/shared(\/.*)?$/,
        replacement: path.resolve(__dirname, '../shared/src') + '$1',
      },
    ],
  },
});
