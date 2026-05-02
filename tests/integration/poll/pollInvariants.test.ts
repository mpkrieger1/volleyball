// PRD Sprint 9 exit tests, verified against a full 13-week season.
// Runs under `npm run test:season` — excluded from default suite because it
// takes ~3 minutes.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { poll } from '@vcd/shared';
import { generateAndPersistSchedule } from '../../../main/src/schedule/generateAndPersist';
import { advanceWeek } from '../../../main/src/season/advanceWeek';
import { SimWorkerPool } from '../../../main/src/season/workerPool';

const repoRoot = resolve(__dirname, '../../..');
const scriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;
let pool: SimWorkerPool;
const pollsByWeek: Map<number, Awaited<ReturnType<PrismaClient['poll']['findMany']>>> = new Map();

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-pollinv-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'pollinv' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  pool = new SimWorkerPool({ scriptPath, workerCount: 4 });

  // Advance through 13 weeks. Some weeks may have 0 matches; that's fine.
  const TOTAL_WEEKS = 13;
  for (let i = 0; i < TOTAL_WEEKS; i++) {
    const res = await advanceWeek({ dbPath, pool, seed: `pollinv:w${i}` });
    if (!res.ok) throw new Error(`advanceWeek week ${i} failed: ${res.message}`);
  }

  // Cache all weekly polls for reuse.
  for (let w = 0; w < TOTAL_WEEKS; w++) {
    pollsByWeek.set(
      w,
      await client.poll.findMany({ where: { week: w }, orderBy: { rank: 'asc' } }),
    );
  }
}, 600_000);

afterAll(async () => {
  await pool?.shutdown();
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PRD Sprint 9 invariants', () => {
  it('PRD exit test 1: end-of-year top 5 overlaps realistic top 5 by ≥ 4', async () => {
    // Latest week with populated polls.
    let latestWeek = -1;
    for (const [w, rows] of pollsByWeek) {
      if (rows.length > 0 && w > latestWeek) latestWeek = w;
    }
    expect(latestWeek).toBeGreaterThanOrEqual(0);
    const pollTop5 = new Set(
      pollsByWeek
        .get(latestWeek)!
        .slice(0, 5)
        .map((r) => r.teamId),
    );

    // Compute realistic top 5 by winPct*0.7 + opponentWinPct*0.3.
    const teams = await client.team.findMany();
    const played = await client.match.findMany({
      where: { winnerId: { not: null } },
      select: { homeTeamId: true, awayTeamId: true, winnerId: true, date: true },
    });
    const metrics = poll.computeTeamMetrics(
      played.map((m) => ({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        winnerId: m.winnerId!,
        date: m.date,
      })),
      teams.map((t) => t.id),
    );
    const realisticTop5 = new Set(
      [...metrics.values()]
        .filter((m) => m.gamesPlayed >= 10) // exclude teams that didn't play enough
        .sort((a, b) => {
          const as = a.winPct * 0.7 + a.opponentWinPct * 0.3;
          const bs = b.winPct * 0.7 + b.opponentWinPct * 0.3;
          if (bs !== as) return bs - as;
          return a.teamId.localeCompare(b.teamId);
        })
        .slice(0, 5)
        .map((m) => m.teamId),
    );

    const overlap = [...pollTop5].filter((id) => realisticTop5.has(id)).length;
    // eslint-disable-next-line no-console
    console.log(
      `PRD S9 exit test 1: overlap=${overlap} poll=[${[...pollTop5]}] realistic=[${[...realisticTop5]}]`,
    );
    expect(overlap).toBeGreaterThanOrEqual(4);
  });

  it('PRD exit test 2: no team that lost its last 3 matches rises in the poll', async () => {
    // For each week w > 0, for each team with 0-3 last-3 coming in, assert
    // their rank did not IMPROVE vs week w-1.
    const teams = await client.team.findMany();
    const allPlayed = await client.match.findMany({
      where: { winnerId: { not: null } },
      orderBy: { date: 'asc' },
      select: { homeTeamId: true, awayTeamId: true, winnerId: true, date: true, week: true },
    });

    for (const [w, rows] of pollsByWeek) {
      if (w === 0 || rows.length === 0) continue;
      const prev = pollsByWeek.get(w - 1) ?? [];
      if (prev.length === 0) continue;
      const prevRank = new Map(prev.map((r) => [r.teamId, r.rank]));

      // Metrics THROUGH week w-1 (before this week's matches influence last-3).
      const playedThroughPrev = allPlayed.filter((m) => m.week < w);
      const metrics = poll.computeTeamMetrics(
        playedThroughPrev.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          winnerId: m.winnerId!,
          date: m.date,
        })),
        teams.map((t) => t.id),
      );

      for (const r of rows) {
        const m = metrics.get(r.teamId);
        if (!m) continue;
        const lost3 = m.last3Wins === 0 && m.last3Losses >= 3;
        if (!lost3) continue;
        const pr = prevRank.get(r.teamId);
        if (pr == null) continue; // unranked → entering is fine
        expect(
          r.rank,
          `week ${w}, team ${r.teamId} was 0-3 entering; prevRank=${pr}, newRank=${r.rank}`,
        ).toBeGreaterThanOrEqual(pr);
      }
    }
  });

  it('PRD exit test 3: no team jumps > 8 spots without a top-10 upset', async () => {
    const allPlayed = await client.match.findMany({
      where: { winnerId: { not: null } },
      select: { homeTeamId: true, awayTeamId: true, winnerId: true, week: true },
    });

    for (const [w, rows] of pollsByWeek) {
      if (w === 0 || rows.length === 0) continue;
      const prev = pollsByWeek.get(w - 1) ?? [];
      if (prev.length === 0) continue;
      const prevTop10 = new Set(prev.filter((r) => r.rank <= 10).map((r) => r.teamId));
      const prevRank = new Map(prev.map((r) => [r.teamId, r.rank]));
      const thisWeekMatches = allPlayed.filter((m) => m.week === w);
      const upsetWinners = new Set<string>();
      for (const m of thisWeekMatches) {
        const loser = m.winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
        if (prevTop10.has(loser)) upsetWinners.add(m.winnerId);
      }

      for (const r of rows) {
        const pr = prevRank.get(r.teamId);
        if (pr == null) continue;
        const movement = Math.abs(pr - r.rank);
        if (movement <= poll.MAX_NON_UPSET_MOVE) continue;
        // Movement > 8 — must be an upset winner (team that beat a prev-top-10).
        expect(
          upsetWinners.has(r.teamId),
          `week ${w}, team ${r.teamId} moved ${movement} spots (prev=${pr}, now=${r.rank}) without an upset`,
        ).toBe(true);
      }
    }
  });
});
