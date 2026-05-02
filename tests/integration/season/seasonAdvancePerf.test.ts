// Sprint 23 PRD §3.5: regular-season advance (13 weeks) < 2 minutes.
// Chains 13 advanceWeek calls against a warmed pool and asserts the total.

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
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-season-perf-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'season-perf' });
  pool = new SimWorkerPool({ scriptPath, workerCount: 4 });
}, 180_000);

afterAll(async () => {
  await pool?.shutdown();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe.sequential('season-advance perf (PRD §3.5: 13 weeks < 2 min)', () => {
  it('advances 13 regular-season weeks in < 120,000 ms', async () => {
    const perWeekMs: number[] = [];
    const t0 = Date.now();
    for (let i = 0; i < 13; i++) {
      const w0 = Date.now();
      const result = await advanceWeek({ dbPath, pool, seed: `season-perf-w${i}` });
      const w1 = Date.now() - w0;
      perWeekMs.push(w1);
      expect(result.ok).toBe(true);
    }
    const totalMs = Date.now() - t0;
    const median = [...perWeekMs].sort((a, b) => a - b)[Math.floor(perWeekMs.length / 2)] ?? 0;
    // eslint-disable-next-line no-console
    console.log(
      `[season-perf] 13-week total=${totalMs} ms; per-week median=${median} ms; weeks=${perWeekMs.join(',')}`,
    );
    expect(totalMs).toBeLessThan(120_000);
  }, 240_000);
});
