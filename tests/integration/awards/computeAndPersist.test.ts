// Sprint 18: end-to-end test for computeSeasonAwards.
// Seeds a slot DB with synthetic PlayerMatchStat + Set rows so we don't
// have to run a full season simulation. Asserts: 28 Award rows persisted,
// idempotent on re-run, correct positional composition per team.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { awards } from '@vcd/shared';
import { computeSeasonAwards } from '../../../main/src/awards/computeSeasonAwards';
import { pickStartersForTeam } from '../../../main/src/match/pickStarters';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-awards-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

  // Synthesize a season's worth of PlayerMatchStat + Set rows. We pick a
  // subset of teams + their players, give each player one match against
  // every other team's first player, and tune stats by position so the
  // selection algorithm produces sensible AA picks.
  await seedSyntheticSeason(client);
}, 120_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

async function seedSyntheticSeason(c: PrismaClient): Promise<void> {
  const teams = await c.team.findMany({ take: 12, orderBy: { abbr: 'asc' } });
  // Use the production starter picker so each team's 6 starters cover
  // S/OH/MB/OPP/L positions — guarantees the AA pool is fully stocked.
  const startersByTeamId = new Map<string, readonly string[]>();
  const playerMetaById = new Map<string, { position: string; isLibero: boolean }>();
  for (const t of teams) {
    const ids = await pickStartersForTeam(c, t.id);
    startersByTeamId.set(t.id, ids);
    const meta = await c.player.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, position: true, isLibero: true },
    });
    for (const p of meta) playerMetaById.set(p.id, { position: p.position, isLibero: p.isLibero });
  }

  // Each team plays each other team once (12*11/2 = 66 matches).
  let matchIdx = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const home = teams[i]!;
      const away = teams[j]!;
      const matchRow = await c.match.create({
        data: {
          homeTeamId: home.id,
          awayTeamId: away.id,
          date: new Date(2026, 8, 1 + matchIdx),
          week: Math.floor(matchIdx / 5),
          isConference: false,
          isTournament: false,
          winnerId: home.id,
          boxScoreJson: '{}',
          pbpJson: '{}',
        },
      });
      // 4 sets per match.
      for (let s = 0; s < 4; s++) {
        await c.set.create({
          data: { matchId: matchRow.id, index: s, home: 25, away: 18, durationSec: 1200 },
        });
      }
      for (const sideTeam of [home, away]) {
        const starterIds = startersByTeamId.get(sideTeam.id)!;
        const stats = starterIds.map((id, slot) => {
          const meta = playerMetaById.get(id)!;
          return synthStatsForPlayer({ id, position: meta.position, isLibero: meta.isLibero }, slot, matchRow.id);
        });
        await c.playerMatchStat.createMany({ data: stats });
      }
      matchIdx++;
    }
  }
}

function synthStatsForPlayer(
  p: { id: string; position: string; isLibero: boolean },
  slotIndex: number,
  matchId: string,
): {
  playerId: string;
  matchId: string;
  kills: number;
  errors: number;
  totalAttacks: number;
  hittingPct: number;
  assists: number;
  serviceAces: number;
  serviceErrors: number;
  receptionErrors: number;
  digs: number;
  blockSolos: number;
  blockAssists: number;
  rotationMinutes: number;
} {
  const eff = p.isLibero ? 'L' : p.position;
  const base = {
    playerId: p.id,
    matchId,
    kills: 0,
    errors: 1,
    totalAttacks: 0,
    hittingPct: 300,
    assists: 0,
    serviceAces: 1,
    serviceErrors: 1,
    receptionErrors: 1,
    digs: 2,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 80,
  };
  switch (eff) {
    case 'OH':
      return { ...base, kills: 14, totalAttacks: 32, hittingPct: 380, digs: 5 };
    case 'MB':
      return { ...base, kills: 8, totalAttacks: 14, hittingPct: 450, blockSolos: 2, blockAssists: 4 };
    case 'OPP':
      return { ...base, kills: 16, totalAttacks: 36, hittingPct: 360, blockSolos: 1, blockAssists: 2 };
    case 'S':
      return { ...base, assists: 38, digs: 4, serviceAces: 2 };
    case 'L':
      return { ...base, digs: 16, receptionErrors: 0 };
    case 'DS':
      return { ...base, digs: 10 };
    default:
      // Treat slot 5 as L if isLibero (already handled above)
      void slotIndex;
      return base;
  }
}

describe('computeSeasonAwards', () => {
  it('persists exactly AA_TOTAL_SELECTIONS Award rows for the season', async () => {
    const result = await computeSeasonAwards(client, 2026);
    expect(result.ok).toBe(true);
    if (result.ok && !result.skipped) {
      expect(result.count).toBe(awards.AA_TOTAL_SELECTIONS);
    }
    const rows = await client.award.findMany({ where: { seasonYear: 2026 } });
    expect(rows).toHaveLength(awards.AA_TOTAL_SELECTIONS);
  });

  it('every team has exactly 2 OH / 2 MB / 1 OPP / 1 S / 1 L by player position', async () => {
    const rows = await client.award.findMany({ where: { seasonYear: 2026 } });
    const playerIds = rows.map((r) => r.playerId);
    const players = await client.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, position: true, isLibero: true },
    });
    const posById = new Map(
      players.map((p) => [p.id, p.isLibero ? 'L' : p.position] as const),
    );

    for (const team of awards.AA_TEAMS) {
      const teamRows = rows.filter((r) => r.team === team);
      expect(teamRows).toHaveLength(awards.AA_TEAM_SIZE);
      const counts = { OH: 0, MB: 0, OPP: 0, S: 0, L: 0 };
      for (const r of teamRows) {
        const pos = posById.get(r.playerId);
        if (pos && pos in counts) counts[pos as keyof typeof counts]++;
      }
      expect(counts).toEqual(awards.AA_COMPOSITION);
    }
  });

  it('is idempotent — second call skips and does not duplicate', async () => {
    const first = await client.award.count({ where: { seasonYear: 2026 } });
    const result = await computeSeasonAwards(client, 2026);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.skipped).toBe(true);
    const second = await client.award.count({ where: { seasonYear: 2026 } });
    expect(second).toBe(first);
  });

  it('every selected playerId appears at most once across all teams', async () => {
    const rows = await client.award.findMany({ where: { seasonYear: 2026 } });
    const ids = new Set(rows.map((r) => r.playerId));
    expect(ids.size).toBe(rows.length);
  });
});
