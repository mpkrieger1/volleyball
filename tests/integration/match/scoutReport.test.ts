// Sprint 19: scout-report integration test.
// Seeds a slot DB with a mini synthetic season for one opponent team.
// Asserts: top-3 K/set hitters (OH/OPP only), recent form W/L, system from Team.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildScoutReport } from '../../../main/src/match/scoutReport';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

let opponentTeamId: string;
let userTeamId: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-scout-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

  const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
  opponentTeamId = teams[0]!.id;
  userTeamId = teams[1]!.id;

  // Seed 5 prior matches for the opponent — alternating W/L in a known
  // sequence: L, W, L, W, W (oldest → newest, results from opponent POV).
  const matchSpecs: Array<{ daysAgo: number; opponentWon: boolean; setsFor: number; setsAgainst: number }> = [
    { daysAgo: 30, opponentWon: false, setsFor: 1, setsAgainst: 3 }, // L
    { daysAgo: 24, opponentWon: true, setsFor: 3, setsAgainst: 0 },  // W
    { daysAgo: 18, opponentWon: false, setsFor: 2, setsAgainst: 3 }, // L
    { daysAgo: 12, opponentWon: true, setsFor: 3, setsAgainst: 1 },  // W
    { daysAgo: 6, opponentWon: true, setsFor: 3, setsAgainst: 2 },   // W
  ];
  const opponentPlayers = await client.player.findMany({
    where: { teamId: opponentTeamId, position: { in: ['OH', 'OPP'] } },
    select: { id: true, position: true },
    orderBy: { id: 'asc' },
  });
  // Designate one player as "elite hitter": always 18 K/set; the rest get 6 K/set.
  const eliteId = opponentPlayers[0]!.id;
  const otherIds = opponentPlayers.slice(1, 4).map((p) => p.id);

  for (const spec of matchSpecs) {
    const date = new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000);
    const matchRow = await client.match.create({
      data: {
        homeTeamId: opponentTeamId,
        awayTeamId: userTeamId,
        date,
        week: 1,
        isConference: false,
        isTournament: false,
        winnerId: spec.opponentWon ? opponentTeamId : userTeamId,
        boxScoreJson: JSON.stringify({
          home: { team: 'home', players: [], totals: {} },
          away: { team: 'away', players: [], totals: {} },
          homeSetsWon: spec.setsFor,
          awaySetsWon: spec.setsAgainst,
          winner: spec.opponentWon ? 'home' : 'away',
        }),
        pbpJson: '{}',
      },
    });
    // 4 sets per match.
    for (let s = 0; s < 4; s++) {
      await client.set.create({
        data: { matchId: matchRow.id, index: s, home: 25, away: 18, durationSec: 1200 },
      });
    }
    // PlayerMatchStat: elite gets 18 kills × 4 sets = 72 kills/match.
    // Others get 6 kills × 4 sets = 24 kills/match.
    const stats = [
      { playerId: eliteId, kills: 72, totalAttacks: 150 },
      ...otherIds.map((id) => ({ playerId: id, kills: 24, totalAttacks: 60 })),
    ];
    await client.playerMatchStat.createMany({
      data: stats.map((s) => ({
        playerId: s.playerId,
        matchId: matchRow.id,
        kills: s.kills,
        errors: 5,
        totalAttacks: s.totalAttacks,
        hittingPct: Math.round(((s.kills - 5) / s.totalAttacks) * 1000),
        assists: 0,
        serviceAces: 1,
        serviceErrors: 1,
        receptionErrors: 2,
        digs: 5,
        blockSolos: 0,
        blockAssists: 0,
        rotationMinutes: 80,
      })),
    });
  }
}, 120_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('buildScoutReport', () => {
  it('returns system from Team.preferredSystem (default 5-1)', async () => {
    const result = await buildScoutReport(client, opponentTeamId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.system).toBe('5-1');
  });

  it('top-3 hitters returns elite first by K/set', async () => {
    const result = await buildScoutReport(client, opponentTeamId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.topHitters.length).toBeGreaterThan(0);
    expect(result.payload.topHitters.length).toBeLessThanOrEqual(3);
    expect(result.payload.topHitters[0]!.killsPerSet).toBeGreaterThan(
      result.payload.topHitters[1]?.killsPerSet ?? 0,
    );
  });

  it('recent form returns 5 entries oldest → newest with correct W/L sequence', async () => {
    const result = await buildScoutReport(client, opponentTeamId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.recentForm).toHaveLength(5);
    expect(result.payload.recentForm.map((r) => r.result)).toEqual(['L', 'W', 'L', 'W', 'W']);
  });

  it('returns NOT_FOUND for missing team', async () => {
    const result = await buildScoutReport(client, 'no-such-team');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });

  it('returns empty topHitters/recentForm for a team with no prior matches', async () => {
    const teams = await client.team.findMany({ take: 5, orderBy: { abbr: 'asc' } });
    const freshTeam = teams[2]!.id; // not opponentTeamId, not userTeamId
    const result = await buildScoutReport(client, freshTeam);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.topHitters).toEqual([]);
    expect(result.payload.recentForm).toEqual([]);
    expect(result.payload.system).toBe('5-1');
  });
});
