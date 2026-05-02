// Sprint 22: full-season calibration suite. Runs N fixed-seed seasons, pools
// the top-25 averages per metric, and asserts vs the benchmark CSV. If the
// benchmark CSV is a stub, PRD assertions are SKIPPED with a warning so the
// scaffolding still ships in CI without blocking on real data.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { calibration } from '@vcd/shared';
import { runFullSeason } from '../../../main/src/calibration/runFullSeason';
import { aggregateSeasonForCalibration } from '../../../main/src/calibration/aggregateSeason';

const repoRoot = resolve(__dirname, '../../..');
const workerScriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');
const benchmarkPath = resolve(repoRoot, 'prisma/benchmarkData/ncaa-2024-25-stats.csv');

// Sprint 22 cap: 5 seasons pooled per iteration. Reduce locally during dev.
const NUM_SEASONS = Number(process.env.VCD_CALIBRATION_SEASONS ?? '5');

type SeasonAverages = calibration.Top25Aggregates['averages'];

let pooledAverages: SeasonAverages | null = null;
let benchmarkResult: ReturnType<typeof calibration.parseBenchmarkCsv> | null = null;
let tmpRoot: string;

beforeAll(async () => {
  benchmarkResult = calibration.parseBenchmarkCsv(readFileSync(benchmarkPath, 'utf8'));
  if (!benchmarkResult.ok) {
    throw new Error(`Benchmark CSV failed to parse: ${benchmarkResult.error}`);
  }

  tmpRoot = mkdtempSync(join(tmpdir(), 'vcd-calibration-'));
  const perSeason: SeasonAverages[] = [];

  for (let i = 0; i < NUM_SEASONS; i++) {
    const dbPath = join(tmpRoot, `season-${i}.db`);
    const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
    execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
    execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
    await runFullSeason({
      dbPath,
      workerScriptPath,
      seasonYear: 2026,
      seed: `calibration-${i}`,
    });
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    try {
      const agg = await aggregateSeasonForCalibration(client);
      perSeason.push(agg.averages);
      // eslint-disable-next-line no-console
      console.log(
        `[calibration] season ${i} top-25 hit%=${agg.averages.hittingPct.toFixed(3)} ` +
          `K/set=${agg.averages.killsPerSet.toFixed(2)} ` +
          `liberoD/set=${agg.averages.liberoDigsPerSet.toFixed(2)}`,
      );
    } finally {
      await client.$disconnect();
    }
  }

  // Pool: mean of per-season means.
  const meanOf = (key: keyof SeasonAverages): number =>
    perSeason.reduce((s, x) => s + x[key], 0) / perSeason.length;
  pooledAverages = {
    hittingPct: meanOf('hittingPct'),
    killsPerSet: meanOf('killsPerSet'),
    liberoDigsPerSet: meanOf('liberoDigsPerSet'),
    blocksPerSet: meanOf('blocksPerSet'),
    assistsPerSet: meanOf('assistsPerSet'),
  };
  // eslint-disable-next-line no-console
  console.log(
    `[calibration] POOLED (${NUM_SEASONS} seasons) hit%=${pooledAverages.hittingPct.toFixed(3)} ` +
      `K/set=${pooledAverages.killsPerSet.toFixed(2)} ` +
      `liberoD/set=${pooledAverages.liberoDigsPerSet.toFixed(2)}`,
  );
}, 30 * 60_000); // 30-min timeout for 5 seasons.

afterAll(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Sprint 22 calibration vs NCAA 2024-25 benchmark', () => {
  it('benchmark CSV is parseable', () => {
    expect(benchmarkResult?.ok).toBe(true);
  });

  it('5 simulated seasons produce non-NaN pooled averages', () => {
    expect(pooledAverages).not.toBeNull();
    expect(Number.isFinite(pooledAverages!.hittingPct)).toBe(true);
    expect(Number.isFinite(pooledAverages!.killsPerSet)).toBe(true);
    expect(Number.isFinite(pooledAverages!.liberoDigsPerSet)).toBe(true);
  });

  // PRD exit tests — only execute when the benchmark CSV contains real data.
  // The skip variant lets the scaffolding ship + run nightly even before the
  // user provides real 2024-25 data.
  const benchmarkIsReal = (): boolean =>
    benchmarkResult?.ok === true && benchmarkResult.stub === false;

  it.skipIf(!benchmarkIsReal())(
    'PRD exit test 1: top-25 hitting % within ±0.015 of benchmark',
    () => {
      if (!benchmarkResult?.ok || benchmarkResult.stub) return;
      const expected = calibration.benchmarkTop25Averages(benchmarkResult.rows).hittingPct;
      const actual = pooledAverages!.hittingPct;
      const diff = Math.abs(actual - expected);
      // eslint-disable-next-line no-console
      console.log(
        `[calibration] hitting% expected=${expected.toFixed(3)} actual=${actual.toFixed(3)} diff=${diff.toFixed(3)}`,
      );
      expect(diff).toBeLessThanOrEqual(0.015);
    },
  );

  it.skipIf(!benchmarkIsReal())(
    'PRD exit test 2: top-25 K/set within ±0.3 of benchmark',
    () => {
      if (!benchmarkResult?.ok || benchmarkResult.stub) return;
      const expected = calibration.benchmarkTop25Averages(benchmarkResult.rows).killsPerSet;
      const actual = pooledAverages!.killsPerSet;
      const diff = Math.abs(actual - expected);
      // eslint-disable-next-line no-console
      console.log(
        `[calibration] K/set expected=${expected.toFixed(2)} actual=${actual.toFixed(2)} diff=${diff.toFixed(2)}`,
      );
      expect(diff).toBeLessThanOrEqual(0.3);
    },
  );

  it.skipIf(!benchmarkIsReal())(
    'PRD exit test 3: top-25 libero dig/set within ±0.4 of benchmark',
    () => {
      if (!benchmarkResult?.ok || benchmarkResult.stub) return;
      const expected = calibration.benchmarkTop25Averages(benchmarkResult.rows).liberoDigsPerSet;
      const actual = pooledAverages!.liberoDigsPerSet;
      const diff = Math.abs(actual - expected);
      // eslint-disable-next-line no-console
      console.log(
        `[calibration] libero D/set expected=${expected.toFixed(2)} actual=${actual.toFixed(2)} diff=${diff.toFixed(2)}`,
      );
      expect(diff).toBeLessThanOrEqual(0.4);
    },
  );

  it('logs a warning if benchmark CSV is a stub', () => {
    if (benchmarkResult?.ok && benchmarkResult.stub) {
      // eslint-disable-next-line no-console
      console.warn(
        '[calibration] Benchmark CSV is a STUB — PRD exit tests skipped. ' +
          'Replace prisma/benchmarkData/ncaa-2024-25-stats.csv with real 2024-25 NCAA top-25 stats.',
      );
    }
    expect(true).toBe(true);
  });
});
