// PRD Sprint 8 exit test 1: a full week (~170 matches) simulates in < 8 s.
// Our scheduler produces more matches per week than the PRD's real-NCAA
// estimate (~500/week for conference weeks, ~300 for week 0). Enforce the
// < 8 s budget against our actual volume, which is stricter than the PRD's.

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
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-perf-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'perf-test' });
  pool = new SimWorkerPool({ scriptPath, workerCount: 4 });
  // Warm up: one advance to amortize worker startup cost, so the measurement
  // reflects steady-state advance throughput (Sprint 8's real concern).
  await advanceWeek({ dbPath, pool, seed: 'warm' });
}, 180_000);

afterAll(async () => {
  await pool?.shutdown();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('week-advance perf (PRD S8 exit test 1)', () => {
  it('advance one week in < 8 s (warmed pool)', async () => {
    const t0 = Date.now();
    const result = await advanceWeek({ dbPath, pool, seed: 'perf-meas' });
    const elapsed = Date.now() - t0;
    expect(result.ok).toBe(true);
    // eslint-disable-next-line no-console
    console.log(`week-advance elapsed: ${elapsed} ms`);
    expect(elapsed).toBeLessThan(8000);
  }, 30_000);
});
