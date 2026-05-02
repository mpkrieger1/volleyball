// Sprint 20 PRD exit test 3: chart data sums match the raw box score.
//
// Runs a real match end-to-end via simulateAndPersistMatch (Sprint 19 path
// with useCoachAi: true), loads the match, computes all 5 chart datasets,
// and asserts the cross-validation invariants from the plan.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { analytics, sim } from '@vcd/shared';
import { simulateAndPersistMatch } from '../../../main/src/match/simulateAndPersist';
import { getMatchById } from '../../../main/src/match/getMatchById';
import { pickStartersForTeam } from '../../../main/src/match/pickStarters';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;
let matchId: string;
let payload: ReturnType<typeof getMatchById> extends Promise<infer R>
  ? R extends { ok: true; payload: infer P }
    ? P
    : never
  : never;
let homeBlockRatings: number[];
let awayBlockRatings: number[];
let homePlayerIds: readonly string[];
let awayPlayerIds: readonly string[];

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-analytics-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

  const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
  const result = await simulateAndPersistMatch({
    dbPath,
    homeTeamId: teams[0]!.id,
    awayTeamId: teams[1]!.id,
    seed: 'analytics-cross-val',
  });
  matchId = result.matchId;

  const loaded = await getMatchById(client, matchId);
  if (!loaded.ok) throw new Error(`getMatchById failed: ${loaded.message}`);
  payload = loaded.payload;

  homePlayerIds = await pickStartersForTeam(client, teams[0]!.id);
  awayPlayerIds = await pickStartersForTeam(client, teams[1]!.id);
  const allIds = [...homePlayerIds, ...awayPlayerIds];
  const players = await client.player.findMany({
    where: { id: { in: allIds } },
    select: { id: true, ratingBlock: true },
  });
  const blockById = new Map(players.map((p) => [p.id, p.ratingBlock]));
  homeBlockRatings = homePlayerIds.map((id) => blockById.get(id) ?? 0);
  awayBlockRatings = awayPlayerIds.map((id) => blockById.get(id) ?? 0);
}, 120_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 20 cross-validation: chart sums match box score', () => {
  it('rotation hitting%: Σ kills across rotations == box score totals.kills (per team)', () => {
    const data = analytics.computeRotationHittingPct(payload.pbp);
    const homeRotKills = data.homeCounts.reduce((s, c) => s + c.kills, 0);
    const awayRotKills = data.awayCounts.reduce((s, c) => s + c.kills, 0);
    expect(homeRotKills).toBe(payload.boxScore.home.totals.kills);
    expect(awayRotKills).toBe(payload.boxScore.away.totals.kills);
  });

  it('rotation hitting%: Σ totalAttacks across rotations == box score totals.totalAttacks (per team)', () => {
    const data = analytics.computeRotationHittingPct(payload.pbp);
    const homeRotTA = data.homeCounts.reduce((s, c) => s + c.totalAttacks, 0);
    const awayRotTA = data.awayCounts.reduce((s, c) => s + c.totalAttacks, 0);
    expect(homeRotTA).toBe(payload.boxScore.home.totals.totalAttacks);
    expect(awayRotTA).toBe(payload.boxScore.away.totals.totalAttacks);
  });

  it('K/set scatter: Σ kills across home points == box score home totals.kills', () => {
    const data = analytics.computeKPerSetVsBlock({
      boxScore: payload.boxScore,
      setsPlayed: payload.sets.length,
      home: {
        lineupSlots: payload.home.lineupSlots,
        lineupRatingsBlock: homeBlockRatings,
        lineupPositions: ['', '', '', '', '', ''],
        lineupPlayerIds: homePlayerIds,
      },
      away: {
        lineupSlots: payload.away.lineupSlots,
        lineupRatingsBlock: awayBlockRatings,
        lineupPositions: ['', '', '', '', '', ''],
        lineupPlayerIds: awayPlayerIds,
      },
    });
    const homeKills = data.filter((p) => p.isHome).reduce((s, p) => s + p.kills, 0);
    const awayKills = data.filter((p) => !p.isHome).reduce((s, p) => s + p.kills, 0);
    expect(homeKills).toBe(payload.boxScore.home.totals.kills);
    expect(awayKills).toBe(payload.boxScore.away.totals.kills);
  });

  it('reception histogram grade 0: Σ across players (per team) == box score receptionErrors', () => {
    const data = analytics.computeReceptionGradeHistogram({
      pbp: payload.pbp,
      home: { lineupSlots: payload.home.lineupSlots, lineupPlayerIds: homePlayerIds },
      away: { lineupSlots: payload.away.lineupSlots, lineupPlayerIds: awayPlayerIds },
    });
    const homeGrade0 = data.filter((r) => r.isHome).reduce((s, r) => s + r.grade0, 0);
    const awayGrade0 = data.filter((r) => !r.isHome).reduce((s, r) => s + r.grade0, 0);
    expect(homeGrade0).toBe(payload.boxScore.home.totals.receptionErrors);
    expect(awayGrade0).toBe(payload.boxScore.away.totals.receptionErrors);
  });

  it('reception histogram: grades 1/2/3 are non-negative', () => {
    const data = analytics.computeReceptionGradeHistogram({
      pbp: payload.pbp,
      home: { lineupSlots: payload.home.lineupSlots, lineupPlayerIds: homePlayerIds },
      away: { lineupSlots: payload.away.lineupSlots, lineupPlayerIds: awayPlayerIds },
    });
    for (const r of data) {
      expect(r.grade1).toBeGreaterThanOrEqual(0);
      expect(r.grade2).toBeGreaterThanOrEqual(0);
      expect(r.grade3).toBeGreaterThanOrEqual(0);
    }
  });

  it('serve heatmap: Σ aces == box score serviceAces (per team)', () => {
    const data = analytics.computeServeZoneHeatmap(payload.pbp);
    const homeAces = data.filter((c) => c.servingTeam === 'home').reduce((s, c) => s + c.aces, 0);
    const awayAces = data.filter((c) => c.servingTeam === 'away').reduce((s, c) => s + c.aces, 0);
    expect(homeAces).toBe(payload.boxScore.home.totals.serviceAces);
    expect(awayAces).toBe(payload.boxScore.away.totals.serviceAces);
  });

  it('serve heatmap: Σ errors == box score serviceErrors (per team)', () => {
    const data = analytics.computeServeZoneHeatmap(payload.pbp);
    const homeErr = data
      .filter((c) => c.servingTeam === 'home')
      .reduce((s, c) => s + c.errors, 0);
    const awayErr = data
      .filter((c) => c.servingTeam === 'away')
      .reduce((s, c) => s + c.errors, 0);
    expect(homeErr).toBe(payload.boxScore.home.totals.serviceErrors);
    expect(awayErr).toBe(payload.boxScore.away.totals.serviceErrors);
  });

  it('rally length: Σ home points across buckets == box score home set scores total', () => {
    const data = analytics.computeRallyLengthDistribution(payload.pbp);
    const homePoints = data.reduce((s, r) => s + r.homePoints, 0);
    const awayPoints = data.reduce((s, r) => s + r.awayPoints, 0);
    const expectedHome = payload.sets.reduce((s, set) => s + set.home, 0);
    const expectedAway = payload.sets.reduce((s, set) => s + set.away, 0);
    expect(homePoints).toBe(expectedHome);
    expect(awayPoints).toBe(expectedAway);
  });

  it('rally length: Σ count == total rallies in PBP', () => {
    const data = analytics.computeRallyLengthDistribution(payload.pbp);
    const totalCount = data.reduce((s, r) => s + r.count, 0);
    const expected = payload.pbp.sets.reduce((s, set) => s + set.rallies.length, 0);
    expect(totalCount).toBe(expected);
  });

  it('replay(pbp) box score equals stored box score (Sprint 6 invariant still holds)', () => {
    const replayed = sim.replayPbp(payload.pbp);
    expect(replayed).toEqual(payload.boxScore);
  });
});
