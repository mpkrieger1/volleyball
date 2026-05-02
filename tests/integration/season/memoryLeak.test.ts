// PRD Sprint 8 exit test 3: 10 consecutive advances → no heap growth > 50 MB.
//
// Node heap measurements are noisy. Strategy:
//   1. Warm up (one advance) so first-time allocations amortize.
//   2. Record heap AFTER each advance.
//   3. Try to force GC between samples. `--expose-gc` enables `global.gc()`;
//      if unavailable, we fall back to a tolerant threshold.
//   4. Assert: last-3 average − first-3 average < 50 MB.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generateAndPersistSchedule } from '../../../main/src/schedule/generateAndPersist';
import { advanceWeek } from '../../../main/src/season/advanceWeek';
import { SimWorkerPool } from '../../../main/src/season/workerPool';

const repoRoot = resolve(__dirname, '../../..');
const scriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');
let tmpDir: string;
let dbPath: string;
let pool: SimWorkerPool;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-leak-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'leak-test' });
  pool = new SimWorkerPool({ scriptPath, workerCount: 4 });
  // Warm up
  await advanceWeek({ dbPath, pool, seed: 'warm' });
}, 180_000);

afterAll(async () => {
  await pool?.shutdown();
  rmSync(tmpDir, { recursive: true, force: true });
});

function heapMB(): number {
  if (typeof global.gc === 'function') global.gc();
  return process.memoryUsage().heapUsed / (1024 * 1024);
}

describe('memory leak (PRD S8 exit test 3)', () => {
  it('10 consecutive advances grow < 50 MB (last-3 mean vs first-3 mean)', async () => {
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = await advanceWeek({ dbPath, pool, seed: `leak-${i}` });
      // Some weeks may have 0 matches by this point (schedule runs out).
      // Just require the call to return ok.
      expect(result.ok).toBe(true);
      samples.push(heapMB());
    }
    const firstMean = (samples[0]! + samples[1]! + samples[2]!) / 3;
    const lastMean = (samples[7]! + samples[8]! + samples[9]!) / 3;
    const growth = lastMean - firstMean;
    // eslint-disable-next-line no-console
    console.log(
      `memory samples (MB): ${samples.map((s) => s.toFixed(1)).join(', ')} · growth=${growth.toFixed(1)}`,
    );
    expect(growth).toBeLessThan(50);
  }, 180_000);
});
