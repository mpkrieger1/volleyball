// Sprint 24 PRD §5 exit test 2: Windows installer < 250 MB.
//
// Runs against the build output at `release/` after `npm run build:installer`.
// Skipped if the artifact doesn't exist (so dev-side `npm test` doesn't
// fail before a build has been produced). CI runs `build:installer` as
// the prior step, then this assertion.

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const releaseDir = resolve(__dirname, '../../../release');
const TARGET_BYTES = 250 * 1024 * 1024;

describe('Sprint 24 PRD §5 exit test 2 — installer size', () => {
  it('release/*.exe < 250 MB', () => {
    if (!existsSync(releaseDir)) {
      // eslint-disable-next-line no-console
      console.warn(`[installer-size] ${releaseDir} not found — skipping. Run \`npm run build:installer\` first.`);
      return;
    }
    const files = readdirSync(releaseDir).filter((f) => f.endsWith('.exe'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const path = join(releaseDir, f);
      const size = statSync(path).size;
      // eslint-disable-next-line no-console
      console.log(`[installer-size] ${f} = ${(size / 1024 / 1024).toFixed(2)} MB`);
      expect(size).toBeLessThan(TARGET_BYTES);
    }
  });
});
