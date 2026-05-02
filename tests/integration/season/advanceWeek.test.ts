import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateAndPersistSchedule } from '../../../main/src/schedule/generateAndPersist';
import { advanceWeek } from '../../../main/src/season/advanceWeek';
import { SimWorkerPool } from '../../../main/src/season/workerPool';
import { CancellationToken } from '../../../main/src/season/cancellationToken';

const repoRoot = resolve(__dirname, '../../..');
const scriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;
let pool: SimWorkerPool;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-advance-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'adv-test' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  pool = new SimWorkerPool({ scriptPath, workerCount: 4 });
}, 180_000);

afterAll(async () => {
  await pool?.shutdown();
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('advanceWeek', () => {
  it('advances week 0 atomically and bumps Season.currentWeek', async () => {
    const before = await client.season.findFirst();
    expect(before!.currentWeek).toBe(0);
    const beforePlayed = await client.match.count({ where: { winnerId: { not: null } } });

    const result = await advanceWeek({ dbPath, pool, seed: 'adv-0' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.week).toBe(0);
      expect(result.matchesPlayed).toBeGreaterThanOrEqual(0);
    }

    const after = await client.season.findFirst();
    expect(after!.currentWeek).toBe(1);
    const afterPlayed = await client.match.count({ where: { winnerId: { not: null } } });
    expect(afterPlayed).toBeGreaterThanOrEqual(beforePlayed);

    // Every week-0 match should now have a winner.
    const week0Unplayed = await client.match.count({ where: { week: 0, winnerId: null } });
    expect(week0Unplayed).toBe(0);
  }, 60_000);

  it('progress callback fires monotonically and ends at total', async () => {
    // Advance week 1 (schedule has some matches in weeks 1–2 as non-conf).
    const progressLog: Array<{ completed: number; total: number; phase: string }> = [];
    const result = await advanceWeek({
      dbPath,
      pool,
      seed: 'adv-1',
      onProgress: (evt) => {
        progressLog.push({
          completed: evt.completedMatches,
          total: evt.totalMatches,
          phase: evt.phase,
        });
      },
    });
    expect(result.ok).toBe(true);
    // Monotonic completed counts during 'sim' phase.
    const simEvents = progressLog.filter((e) => e.phase === 'sim');
    for (let i = 1; i < simEvents.length; i++) {
      expect(simEvents[i]!.completed).toBeGreaterThanOrEqual(simEvents[i - 1]!.completed);
    }
    // Final event is 'done' with completed === total.
    const last = progressLog[progressLog.length - 1]!;
    expect(last.phase).toBe('done');
    expect(last.completed).toBe(last.total);
  }, 60_000);

  it('cancellation leaves the DB unchanged (PRD S8 exit test 2)', async () => {
    const before = await client.season.findFirst();
    const beforeWeek = before!.currentWeek;
    const beforePlayed = await client.match.count({ where: { winnerId: { not: null } } });

    const token = new CancellationToken();
    // Cancel immediately so few/no matches actually persist.
    const promise = advanceWeek({ dbPath, pool, cancellation: token, seed: 'adv-cancel' });
    token.cancel();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CANCELLED');

    const after = await client.season.findFirst();
    expect(after!.currentWeek).toBe(beforeWeek);
    const afterPlayed = await client.match.count({ where: { winnerId: { not: null } } });
    expect(afterPlayed).toBe(beforePlayed);
  }, 60_000);
});
