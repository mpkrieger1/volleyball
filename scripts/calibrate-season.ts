// Sprint 22: manual single-season calibration runner. Used during tuning
// iterations to spot-check a knob change without spinning up the full
// 5-season Vitest suite. Optionally appends a results row to the
// tuning-log so each manual iteration is auditable.
//
// Usage:
//   npx tsx scripts/calibrate-season.ts --seed=A
//   npx tsx scripts/calibrate-season.ts --seed=A --append-log
//   VCD_CALIBRATION_SEASONS=1 npm run calibrate:run -- --seed=baseline-1

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { calibration } from '@vcd/shared';
import { runFullSeason } from '../main/src/calibration/runFullSeason';
import { aggregateSeasonForCalibration } from '../main/src/calibration/aggregateSeason';

type Args = { seed: string; appendLog: boolean; seasonYear: number };

function parseArgs(argv: string[]): Args {
  const args: Args = { seed: 'manual', appendLog: false, seasonYear: 2026 };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--seed=')) args.seed = a.slice('--seed='.length);
    else if (a === '--append-log') args.appendLog = true;
    else if (a.startsWith('--year=')) args.seasonYear = parseInt(a.slice('--year='.length), 10);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const repoRoot = resolve(__dirname, '..');
  const benchmarkPath = resolve(repoRoot, 'prisma/benchmarkData/ncaa-2024-25-stats.csv');
  const workerScriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');
  const logPath = resolve(repoRoot, 'docs/calibration/tuning-log.md');

  if (!existsSync(workerScriptPath)) {
    console.error(`Worker bundle missing at ${workerScriptPath}. Run: npm -w workers run build`);
    process.exit(1);
  }

  const benchmark = calibration.parseBenchmarkCsv(readFileSync(benchmarkPath, 'utf8'));
  if (!benchmark.ok) {
    console.error(`Benchmark CSV failed to parse: ${benchmark.error}`);
    process.exit(1);
  }
  const stub = benchmark.stub;
  const benchAvg = stub
    ? null
    : calibration.benchmarkTop25Averages(benchmark.rows);

  const tmpRoot = mkdtempSync(join(tmpdir(), 'vcd-calibrate-cli-'));
  const dbPath = join(tmpRoot, 'season.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };

  console.log(`[calibrate] seed=${args.seed} year=${args.seasonYear} db=${dbPath}`);
  console.log(`[calibrate] benchmark=${stub ? 'STUB (no comparison)' : 'real'}`);

  try {
    execSync('npx prisma migrate deploy', { cwd: repoRoot, env, stdio: 'inherit' });
    execSync('npx tsx prisma/seed.ts', { cwd: repoRoot, env, stdio: 'inherit' });

    const t0 = Date.now();
    const summary = await runFullSeason({
      dbPath,
      workerScriptPath,
      seasonYear: args.seasonYear,
      seed: args.seed,
    });
    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[calibrate] season finished in ${elapsedSec}s — ${JSON.stringify(summary)}`);

    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
    let agg;
    try {
      agg = await aggregateSeasonForCalibration(client);
    } finally {
      await client.$disconnect();
    }

    const a = agg.averages;
    console.log('\n[calibrate] Top-25 averages');
    console.log(`  hitting %        ${a.hittingPct.toFixed(3)}` + diffStr(a.hittingPct, benchAvg?.hittingPct, 0.015));
    console.log(`  K/set            ${a.killsPerSet.toFixed(2)}` + diffStr(a.killsPerSet, benchAvg?.killsPerSet, 0.3));
    console.log(`  libero D/set     ${a.liberoDigsPerSet.toFixed(2)}` + diffStr(a.liberoDigsPerSet, benchAvg?.liberoDigsPerSet, 0.4));
    console.log(`  blocks/set       ${a.blocksPerSet.toFixed(2)}` + diffStr(a.blocksPerSet, benchAvg?.blocksPerSet));
    console.log(`  assists/set      ${a.assistsPerSet.toFixed(2)}` + diffStr(a.assistsPerSet, benchAvg?.assistsPerSet));

    if (args.appendLog) {
      const ts = new Date().toISOString();
      const line =
        `\n| ${ts} | ${args.seed} | ${a.hittingPct.toFixed(3)} | ${a.killsPerSet.toFixed(2)} | ` +
        `${a.liberoDigsPerSet.toFixed(2)} | ${a.blocksPerSet.toFixed(2)} | ${a.assistsPerSet.toFixed(2)} | ${stub ? 'STUB' : 'real'} |`;
      appendFileSync(logPath, line + '\n', 'utf8');
      console.log(`\n[calibrate] appended to ${logPath}`);
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function diffStr(actual: number, expected: number | undefined, tolerance?: number): string {
  if (expected === undefined) return '';
  const d = actual - expected;
  const inBand = tolerance !== undefined ? Math.abs(d) <= tolerance : true;
  const mark = tolerance !== undefined ? (inBand ? ' ✓' : ' ✗') : '';
  return `   (Δ ${d >= 0 ? '+' : ''}${d.toFixed(3)} vs ${expected.toFixed(3)}${mark})`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
