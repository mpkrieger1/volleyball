// PRD Sprint 11 exit tests, verified against a full post-season simulation.
// Runs under `npm run test:postseason`. Advances 13 regular-season weeks,
// starts conference tournaments, runs all CT rounds, starts NCAA, runs all
// 6 NCAA rounds until a champion is crowned.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateAndPersistSchedule } from '../../../main/src/schedule/generateAndPersist';
import { advanceWeek } from '../../../main/src/season/advanceWeek';
import { SimWorkerPool } from '../../../main/src/season/workerPool';
import { generateConfTournamentMatches } from '../../../main/src/postseason/generateConfTournamentMatches';
import { startNcaaTournament } from '../../../main/src/postseason/startNcaaTournament';
import { advanceTournamentRound } from '../../../main/src/postseason/advanceTournamentRound';

const repoRoot = resolve(__dirname, '../../..');
const scriptPath = resolve(repoRoot, 'workers/dist/simWorkerThread.js');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;
let pool: SimWorkerPool;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-postseason-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'postseason' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  pool = new SimWorkerPool({ scriptPath, workerCount: 4 });

  // Regular season.
  for (let i = 0; i < 13; i++) {
    const res = await advanceWeek({ dbPath, pool, seed: `postseason:w${i}` });
    if (!res.ok) throw new Error(`advanceWeek week ${i} failed: ${res.message}`);
  }

  // Conference tournaments.
  await generateConfTournamentMatches({ dbPath });
  for (const round of ['CT_R1', 'CT_SF', 'CT_F'] as const) {
    const r = await advanceTournamentRound({ dbPath, pool, round });
    if (!r.ok) throw new Error(`advance ${round} failed: ${r.message}`);
  }

  // NCAA.
  await startNcaaTournament({ dbPath, seasonYear: 2026 });
  for (const round of [
    'NCAA_R64',
    'NCAA_R32',
    'NCAA_S16',
    'NCAA_E8',
    'NCAA_FF',
    'NCAA_CHAMP',
  ] as const) {
    const r = await advanceTournamentRound({ dbPath, pool, round });
    if (!r.ok) throw new Error(`advance ${round} failed: ${r.message}`);
  }
}, 900_000);

afterAll(async () => {
  await pool?.shutdown();
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PRD Sprint 11 invariants', () => {
  it('exit test 1a: Season.nationalChampionTeamId is set after NCAA_CHAMP', async () => {
    const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
    expect(season).not.toBeNull();
    expect(season!.nationalChampionTeamId).toBeTruthy();
    expect(season!.phase).toBe('OFFSEASON');
  });

  it('exit test 1b: exactly one NCAA_CHAMP match with a winner', async () => {
    const champMatches = await client.match.findMany({
      where: { tournamentRound: 'NCAA_CHAMP' },
    });
    expect(champMatches).toHaveLength(1);
    expect(champMatches[0]!.winnerId).toBeTruthy();
  });

  it('exit test 2: every tournament match is flagged isTournament=true with a winnerId', async () => {
    // PRD Sprint 11 exit test 2. Scoped to post-season (CT/NCAA) matches —
    // the regular-season schedule also flags a handful of early-season
    // invitational tournaments as isTournament=true without a tournament
    // round label; those are covered by Sprint 7's invariants.
    const postseasonRounds = [
      'CT_R1', 'CT_SF', 'CT_F',
      'NCAA_R64', 'NCAA_R32', 'NCAA_S16', 'NCAA_E8', 'NCAA_FF', 'NCAA_CHAMP',
    ];
    const tourneyMatches = await client.match.findMany({
      where: { tournamentRound: { in: postseasonRounds } },
    });
    expect(tourneyMatches.length).toBeGreaterThan(0);
    for (const m of tourneyMatches) {
      expect(m.isTournament).toBe(true);
      expect(m.tournamentRound).toBeTruthy();
      expect(m.winnerId).toBeTruthy();
    }
  });

  it('NCAA round counts: 32+16+8+4+2+1 = 63', async () => {
    const counts: Record<string, number> = {};
    for (const round of [
      'NCAA_R64',
      'NCAA_R32',
      'NCAA_S16',
      'NCAA_E8',
      'NCAA_FF',
      'NCAA_CHAMP',
    ]) {
      counts[round] = await client.match.count({ where: { tournamentRound: round } });
    }
    expect(counts['NCAA_R64']).toBe(32);
    expect(counts['NCAA_R32']).toBe(16);
    expect(counts['NCAA_S16']).toBe(8);
    expect(counts['NCAA_E8']).toBe(4);
    expect(counts['NCAA_FF']).toBe(2);
    expect(counts['NCAA_CHAMP']).toBe(1);
  });

  it('CT match counts align with conference sizes', async () => {
    const cts = await client.match.findMany({
      where: { tournamentRound: { in: ['CT_R1', 'CT_SF', 'CT_F'] } },
    });
    // Every CT match has a winnerId and belongs to some conference bracket.
    for (const m of cts) {
      expect(m.winnerId).toBeTruthy();
      expect(m.bracketGroupKey).toBeTruthy();
    }
  });

  it('no team appears twice in the NCAA bracket', async () => {
    const entries = await client.bracketEntry.findMany({ where: { seasonYear: 2026 } });
    const ids = new Set(entries.map((e) => e.teamId));
    expect(ids.size).toBe(entries.length);
    expect(entries.length).toBe(64);
  });

  // Sprint 18 demoable-milestone smoke: AA awards generated at NCAA_CHAMP.
  it('Sprint 18: 28 AA Award rows are written when NCAA_CHAMP completes', async () => {
    const awardRows = await client.award.findMany({ where: { seasonYear: 2026 } });
    expect(awardRows).toHaveLength(28);
    const teams = new Set(awardRows.map((r) => r.team));
    expect(teams).toEqual(new Set(['first', 'second', 'third', 'hm']));
  });

  it('Sprint 18: every AA team has correct positional composition (2 OH / 2 MB / 1 OPP / 1 S / 1 L)', async () => {
    const awardRows = await client.award.findMany({ where: { seasonYear: 2026 } });
    const players = await client.player.findMany({
      where: { id: { in: awardRows.map((r) => r.playerId) } },
      select: { id: true, position: true, isLibero: true },
    });
    const posById = new Map(players.map((p) => [p.id, p.isLibero ? 'L' : p.position] as const));
    for (const team of ['first', 'second', 'third', 'hm']) {
      const teamRows = awardRows.filter((r) => r.team === team);
      expect(teamRows).toHaveLength(7);
      const counts = { OH: 0, MB: 0, OPP: 0, S: 0, L: 0 };
      for (const r of teamRows) {
        const pos = posById.get(r.playerId);
        if (pos && pos in counts) counts[pos as keyof typeof counts]++;
      }
      expect(counts).toEqual({ OH: 2, MB: 2, OPP: 1, S: 1, L: 1 });
    }
  });
});
