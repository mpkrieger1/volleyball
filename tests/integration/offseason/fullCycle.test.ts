// PRD Sprint 16 exit tests.
//
// Exit test 1: over 5 offseasons with synthetic churn, no team exceeds
//              SCHOLARSHIP_CAP.
// Exit test 2: starters (>50% playTime) grow more in `attack` than bench
//              warmers (p < 0.05, Welch's t-test).
// Exit test 3: all SR players removed from Player + present in
//              PlayerArchive.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { offseason } from '@vcd/shared';
import { runOffseason } from '../../../main/src/offseason/runOffseason';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-offsim-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  await client.season.create({
    data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 },
  });
}, 300_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PRD Sprint 16 invariants', () => {
  it('exit test 1: 5 offseasons with synthetic churn, no team exceeds SCHOLARSHIP_CAP', async () => {
    for (let i = 0; i < 5; i++) {
      // Pre-offseason tick: ensure Season.phase is OFFSEASON (runOffseason
      // sets PRESEASON).
      await client.season.updateMany({ data: { phase: 'OFFSEASON' } });

      // Verify cap at each pre-offseason tick.
      const byTeam = await client.player.groupBy({
        by: ['teamId'],
        _count: { _all: true },
      });
      for (const row of byTeam) {
        expect(row._count._all).toBeLessThanOrEqual(offseason.SCHOLARSHIP_CAP);
      }

      // Run the offseason.
      await runOffseason({ dbPath, seed: `sim:${i}` });

      // Synthetic churn: inject a few new recruits as FR players for each
      // team to simulate incoming class (bypass full recruiting cycle).
      const teams = await client.team.findMany({ select: { id: true } });
      const newPlayers = [];
      for (const t of teams) {
        for (let p = 0; p < 3; p++) {
          newPlayers.push({
            teamId: t.id,
            firstName: `Recruit${i}`,
            lastName: `Cycle${p}`,
            position: ['OH', 'MB', 'S'][p % 3]!,
            classYear: 'FR',
            height: 180,
            jersey: 50 + p,
            ratingAttack: 60, ratingBlock: 55, ratingServe: 55, ratingPass: 60,
            ratingSet: 50, ratingDig: 55, ratingAthleticism: 60, ratingIq: 55, ratingStamina: 60,
            potential: 80,
            redshirtUsed: false,
            redshirtLocked: false,
            isLibero: false,
            isCaptain: false,
          });
        }
      }
      const CHUNK = 500;
      for (let off = 0; off < newPlayers.length; off += CHUNK) {
        await client.player.createMany({ data: newPlayers.slice(off, off + CHUNK) });
      }
    }
    // Final cap check.
    const byTeam = await client.player.groupBy({
      by: ['teamId'],
      _count: { _all: true },
    });
    for (const row of byTeam) {
      expect(row._count._all).toBeLessThanOrEqual(offseason.SCHOLARSHIP_CAP);
    }
  }, 600_000);

  // Sprint 33 design pivot: the original Sprint 16 dev model
  // (`computePlayerGrowth` scaled by playing time) was REPLACED by FCCD's
  // coach-attribute-focus training event (TRAINING_RESULTS) which does
  // NOT differentiate by playing time. v1.2 ships without this signal;
  // v1.3 may re-introduce playing-time scaling via a coach-skill perk.
  // CLAUDE.md "Sprint 32-33 player-development pivot" invariant.
  it.skip('exit test 2: starters grow more in attack than benchwarmers (p < 0.05) — DELETED Sprint 37 (Sprint 33 design pivot)', async () => {
    // Fresh save (Sprint 16 flow) for this test.
    const freshDir = mkdtempSync(join(tmpdir(), 'vcd-offsim-xt2-'));
    const freshDb = join(freshDir, 'game.db');
    const env = { ...process.env, DATABASE_URL: `file:${freshDb}` };
    execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
    execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
    const c2 = new PrismaClient({ datasources: { db: { url: `file:${freshDb}` } } });
    try {
      await c2.season.create({ data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 } });

      // Seed synthetic PlayerMatchStat rows. Pick half the players per team
      // as "starters" (high minutes), half as "bench" (low minutes).
      const allPlayers = await c2.player.findMany({
        where: { classYear: { in: ['FR', 'SO', 'JR'] } },
        select: { id: true, teamId: true, position: true },
      });
      // For a synthetic match id we'll use one fake matchId per team.
      // First create one fake Match row per team to satisfy the FK.
      const teams = await c2.team.findMany({ select: { id: true } });
      // Sample ALL teams for maximum statistical power. 360 teams × ~6
      // positions with ≥2 players each ≈ 2000 pairs → ≥1000 in each bucket.
      // Sprint 25 (P1.3): switched from `Promise.all` to a serial loop —
      // 360 parallel `match.create` calls hit a Prisma SQLite "timed out
      // after `N/A`" intermittent in Sprint 25's final gate. Serial is
      // ~50% slower (~3s vs ~1.5s on a dev box) but stable.
      const fakeMatches: Array<{ id: string; homeTeamId: string }> = [];
      for (let i = 0; i < teams.length; i++) {
        const t = teams[i]!;
        const m = await c2.match.create({
          data: {
            homeTeamId: t.id,
            awayTeamId: teams[(i + 1) % teams.length]!.id,
            date: new Date(),
            week: 0,
            isConference: false,
            isTournament: false,
            winnerId: t.id,
          },
          select: { id: true, homeTeamId: true },
        });
        fakeMatches.push(m);
      }
      const matchByTeam = new Map(fakeMatches.map((m) => [m.homeTeamId, m.id]));

      const matchStats: Array<{
        playerId: string;
        matchId: string;
        rotationMinutes: number;
      }> = [];
      // Group players by (team, position) so we can pick position-balanced
      // starter/bench pairs. Eliminates a subtle bias: OH attack is near
      // cap while S attack is suppressed — randomly splitting by id could
      // skew growth toward whichever pool got more S players.
      const byTeamPos = new Map<string, Map<string, string[]>>();
      for (const p of allPlayers) {
        let perPos = byTeamPos.get(p.teamId);
        if (!perPos) {
          perPos = new Map();
          byTeamPos.set(p.teamId, perPos);
        }
        let list = perPos.get(p.position);
        if (!list) {
          list = [];
          perPos.set(p.position, list);
        }
        list.push(p.id);
      }
      const starterIds = new Set<string>();
      const benchIds = new Set<string>();
      for (const [teamId, perPos] of byTeamPos) {
        const matchId = matchByTeam.get(teamId);
        if (!matchId) continue;
        for (const [, pids] of perPos) {
          const sorted = pids.slice().sort();
          if (sorted.length < 2) continue;
          const starterId = sorted[0]!;
          const benchId = sorted[1]!;
          matchStats.push({ playerId: starterId, matchId, rotationMinutes: 90 });
          matchStats.push({ playerId: benchId, matchId, rotationMinutes: 5 });
          starterIds.add(starterId);
          benchIds.add(benchId);
        }
      }
      // Chunked insert.
      for (let off = 0; off < matchStats.length; off += 500) {
        await c2.playerMatchStat.createMany({ data: matchStats.slice(off, off + 500) });
      }

      // Capture pre-offseason attack ratings for starters + bench.
      const beforeRows = await c2.player.findMany({
        where: { id: { in: [...starterIds, ...benchIds] } },
        select: { id: true, ratingAttack: true },
      });
      const beforeAttack = new Map(beforeRows.map((r) => [r.id, r.ratingAttack]));

      await runOffseason({ dbPath: freshDb, seed: 'xt2' });

      const afterRows = await c2.player.findMany({
        where: { id: { in: [...starterIds, ...benchIds] } },
        select: { id: true, ratingAttack: true },
      });
      const afterAttack = new Map(afterRows.map((r) => [r.id, r.ratingAttack]));

      const starterGrowth: number[] = [];
      const benchGrowth: number[] = [];
      for (const id of starterIds) {
        const before = beforeAttack.get(id);
        const after = afterAttack.get(id);
        if (before == null || after == null) continue;
        starterGrowth.push(after - before);
      }
      for (const id of benchIds) {
        const before = beforeAttack.get(id);
        const after = afterAttack.get(id);
        if (before == null || after == null) continue;
        benchGrowth.push(after - before);
      }

      const p = welchTTest(starterGrowth, benchGrowth);
      const meanS = starterGrowth.reduce((a, b) => a + b, 0) / Math.max(1, starterGrowth.length);
      const meanB = benchGrowth.reduce((a, b) => a + b, 0) / Math.max(1, benchGrowth.length);
      // eslint-disable-next-line no-console
      console.log(
        `starters n=${starterGrowth.length} mean=${meanS.toFixed(2)}; bench n=${benchGrowth.length} mean=${meanB.toFixed(2)}; Welch p=${p.toExponential(3)}`,
      );
      expect(meanS).toBeGreaterThan(meanB);
      expect(p).toBeLessThan(0.05);
    } finally {
      await c2.$disconnect();
      rmSync(freshDir, { recursive: true, force: true });
    }
  }, 300_000);

  it('exit test 3: all SR players archived after runOffseason', async () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'vcd-offsim-xt3-'));
    const freshDb = join(freshDir, 'game.db');
    const env = { ...process.env, DATABASE_URL: `file:${freshDb}` };
    execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
    execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
    const c3 = new PrismaClient({ datasources: { db: { url: `file:${freshDb}` } } });
    try {
      await c3.season.create({ data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 } });
      const preSrIds = (await c3.player.findMany({
        where: { classYear: 'SR' },
        select: { id: true },
      })).map((p) => p.id);
      expect(preSrIds.length).toBeGreaterThan(0);

      await runOffseason({ dbPath: freshDb, seed: 'xt3' });

      // No SR player ids remain in Player.
      const remaining = await c3.player.count({ where: { id: { in: preSrIds } } });
      expect(remaining).toBe(0);

      // All pre-SR ids present in PlayerArchive with seasonRetired=2026.
      const archived = await c3.playerArchive.findMany({
        where: { originalPlayerId: { in: preSrIds } },
      });
      expect(archived.length).toBe(preSrIds.length);
      for (const a of archived) {
        expect(a.seasonRetired).toBe(2026);
      }
    } finally {
      await c3.$disconnect();
      rmSync(freshDir, { recursive: true, force: true });
    }
  }, 180_000);
});

/** Welch's t-test two-tailed p via normal CDF approximation. */
function welchTTest(a: number[], b: number[]): number {
  const meanA = a.reduce((s, x) => s + x, 0) / a.length;
  const meanB = b.reduce((s, x) => s + x, 0) / b.length;
  const varA = a.reduce((s, x) => s + (x - meanA) ** 2, 0) / Math.max(1, a.length - 1);
  const varB = b.reduce((s, x) => s + (x - meanB) ** 2, 0) / Math.max(1, b.length - 1);
  const se = Math.sqrt(varA / a.length + varB / b.length);
  if (se === 0) return meanA === meanB ? 1 : 0;
  const t = (meanA - meanB) / se;
  return 2 * (1 - normalCdf(Math.abs(t)));
}
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989422804 * Math.exp(-(z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - p;
}
