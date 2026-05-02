// Sprint 23 PRD §5 exit test: 20-season continuous run shows no
// resident-memory growth trend > 100 MB. Asserts both:
//   (a) total drift end-to-start < 100 MB
//   (b) linear-regression slope of (season → heapMB) < 5 MB / season
//
// Excluded from default `npm test` and `npm run test:perf` — slow
// (~15 min). Run manually via `npm run test:perf-long` or in nightly CI.
//
// Run with `--expose-gc` (vitest forks-pool) so we can force GC
// between snapshots and reduce false positives from deferred GC.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { runFullSeason } from '../../../main/src/calibration/runFullSeason';
import { runOffseason } from '../../../main/src/offseason/runOffseason';
import { openRecruitingCycle } from '../../../main/src/recruiting/openRecruitingCycle';
import { advanceRecruitingWeek } from '../../../main/src/recruiting/advanceRecruitingWeek';
import { closeRecruitingCycle } from '../../../main/src/recruiting/closeRecruitingCycle';

const repoRoot = resolve(__dirname, '../../..');
const workerScriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');
const NUM_SEASONS = Number(process.env.VCD_DYNASTY_LONG_SEASONS ?? '20');
const SAVE_BUDGET_MB = 60; // PRD §5: <60 MB at 20 seasons
const HEAP_DRIFT_BUDGET_MB = 100;
const HEAP_SLOPE_BUDGET_MB_PER_SEASON = 5;

/**
 * Sprint 24: real recruiting cycle between seasons. closeRecruitingCycle
 * promotes COMMITTED → Player. See save10Seasons.test.ts jsdoc for
 * the recruiting-AI commit-rate gap that necessitates the topup safety net.
 */
async function runRecruitingForYear(dbPath: string, seasonYear: number, seed: string): Promise<void> {
  await openRecruitingCycle({ dbPath, seasonYear, classSize: 3000, seed, boardSizePerTeam: 20 });
  for (let w = 0; w < 11; w++) {
    await advanceRecruitingWeek({ dbPath, userTeamId: null, seed: `${seed}:w${w}` });
  }
  await closeRecruitingCycle({ dbPath });
}

const POSITIONS = ['OH', 'OH', 'MB', 'MB', 'OPP', 'S', 'L', 'DS'] as const;

async function topupRostersIfDrained(client: PrismaClient, year: number): Promise<void> {
  const teams = await client.team.findMany({
    select: { id: true, _count: { select: { players: true } } },
  });
  const TARGET = 12;
  for (const t of teams) {
    const need = TARGET - t._count.players;
    if (need <= 0) continue;
    const existing = await client.player.findMany({
      where: { teamId: t.id },
      select: { jersey: true },
    });
    const used = new Set(existing.map((p) => p.jersey));
    const data: Array<Record<string, unknown>> = [];
    let i = 0;
    while (data.length < need) {
      let jersey = 1;
      while (used.has(jersey) && jersey < 100) jersey += 1;
      if (jersey >= 100) break;
      used.add(jersey);
      data.push({
        teamId: t.id,
        firstName: `Walkon${year}`,
        lastName: `${t.id.slice(-4)}-${i}`,
        position: POSITIONS[i % POSITIONS.length]!,
        classYear: 'FR',
        height: 175,
        jersey,
        ratingAttack: 50,
        ratingBlock: 50,
        ratingServe: 50,
        ratingPass: 50,
        ratingSet: 50,
        ratingDig: 50,
        ratingAthleticism: 50,
        ratingIq: 50,
        ratingStamina: 50,
        potential: 70,
        redshirtUsed: false,
        isLibero: i % 8 === 6,
      });
      i += 1;
    }
    if (data.length > 0) {
      await client.player.createMany({ data: data as Parameters<typeof client.player.createMany>[0]['data'] });
    }
  }
}

function heapMBNow(): number {
  if (typeof global.gc === 'function') global.gc();
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function linearSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i]!, 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

let tmpDir: string;
let dbPath: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-dynasty-20-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
}, 180_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe.sequential('PRD §5 — 20-season memory & save-size hardening', () => {
  it(`heap drift < ${HEAP_DRIFT_BUDGET_MB} MB and slope < ${HEAP_SLOPE_BUDGET_MB_PER_SEASON} MB/season`, async () => {
    const heapMb: number[] = [];
    const sizesMb: number[] = [];
    const seasonIdx: number[] = [];
    const baseYear = 2026;

    const startHeap = heapMBNow();
    // eslint-disable-next-line no-console
    console.log(`[long] start heap=${startHeap.toFixed(2)} MB`);

    for (let i = 0; i < NUM_SEASONS; i++) {
      const year = baseYear + i;
      await runFullSeason({
        dbPath,
        workerScriptPath,
        seasonYear: year,
        seed: `long-y${i}`,
      });
      await runOffseason({ dbPath, seed: `long-off-y${i}` });
      // Sprint 24: real recruiting cycle promotes COMMITTED → Player rows.
      await runRecruitingForYear(dbPath, year + 1, `long-rec-y${i}`);
      const topupClient = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
      try {
        await topupRostersIfDrained(topupClient, year + 1);
      } finally {
        await topupClient.$disconnect();
      }
      const heap = heapMBNow();
      const sizeMb = statSync(dbPath).size / 1024 / 1024;
      heapMb.push(heap);
      sizesMb.push(sizeMb);
      seasonIdx.push(i);
      // eslint-disable-next-line no-console
      console.log(
        `[long] year=${year} heap=${heap.toFixed(2)} MB save=${sizeMb.toFixed(2)} MB`,
      );
    }

    const drift = heapMb[heapMb.length - 1]! - startHeap;
    const slope = linearSlope(seasonIdx, heapMb);
    const finalSizeMb = sizesMb[sizesMb.length - 1] ?? 0;
    // eslint-disable-next-line no-console
    console.log(
      `[long] drift=${drift.toFixed(2)} MB slope=${slope.toFixed(2)} MB/season ` +
        `finalSave=${finalSizeMb.toFixed(2)} MB`,
    );

    expect(drift).toBeLessThan(HEAP_DRIFT_BUDGET_MB);
    expect(slope).toBeLessThan(HEAP_SLOPE_BUDGET_MB_PER_SEASON);
    // Save-size budget at 20 seasons is more lenient (PRD <60 MB).
    expect(finalSizeMb).toBeLessThan(SAVE_BUDGET_MB);
  }, 90 * 60_000); // 90-min timeout (20 × ~30s + per-season overhead)
});
