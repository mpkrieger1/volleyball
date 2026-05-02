// Sprint 24 Task 24.1: signing day converts COMMITTED Recruit rows
// into freshman Player rows. Closes the v1-blocker surfaced by
// Sprint 23's dynasty test (rosters drained 4,320 → 0 over 4 seasons).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { closeRecruitingCycle } from '../../../main/src/recruiting/closeRecruitingCycle';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-promote-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  await client.season.create({
    data: { year: 2026, phase: 'RECRUITING', currentWeek: 0, recruitingWeek: 11 },
  });
}, 90_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

const RATINGS_BLOB = JSON.stringify({
  attack: 70,
  block: 65,
  serve: 60,
  pass: 55,
  set: 60,
  dig: 60,
  athleticism: 75,
  iq: 65,
  stamina: 70,
});

async function makeRecruit(opts: {
  position: string;
  commitState: 'PENDING' | 'COMMITTED' | 'UNCOMMITTED';
  commitTeamId?: string;
  firstName?: string;
  lastName?: string;
}): Promise<string> {
  const r = await client.recruit.create({
    data: {
      firstName: opts.firstName ?? 'Test',
      lastName: opts.lastName ?? `R-${crypto.randomUUID().slice(0, 7)}`,
      position: opts.position,
      stars: 3,
      ratingsJson: RATINGS_BLOB,
      potential: 80,
      height: 180,
      hometownCity: 'Lincoln',
      hometownState: 'NE',
      hometownRegion: 'CENTRAL',
      commitState: opts.commitState,
      commitTeamId: opts.commitTeamId ?? null,
      seasonYear: 2026,
      committedAtWeek: opts.commitState === 'COMMITTED' ? 5 : null,
    },
  });
  return r.id;
}

describe('closeRecruitingCycle — Sprint 24 Recruit→Player promotion', () => {
  let teamA: string;
  let teamB: string;
  let priorPlayerCount: number;

  beforeAll(async () => {
    const teams = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
    teamA = teams[0]!.id;
    teamB = teams[1]!.id;
    // Seed COMMITTED for teamA (3 recruits across positions) + teamB (1)
    await makeRecruit({ position: 'OH', commitState: 'COMMITTED', commitTeamId: teamA });
    await makeRecruit({ position: 'MB', commitState: 'COMMITTED', commitTeamId: teamA });
    await makeRecruit({ position: 'L', commitState: 'COMMITTED', commitTeamId: teamA });
    await makeRecruit({ position: 'S', commitState: 'COMMITTED', commitTeamId: teamB });
    // 2 PENDING (should flip to UNCOMMITTED)
    await makeRecruit({ position: 'OH', commitState: 'PENDING' });
    await makeRecruit({ position: 'OPP', commitState: 'PENDING' });
    priorPlayerCount = await client.player.count();
  }, 30_000);

  it('promotes all COMMITTED recruits to Player rows', async () => {
    await closeRecruitingCycle({ dbPath });
    const newPlayerCount = await client.player.count();
    expect(newPlayerCount).toBe(priorPlayerCount + 4);
  }, 30_000);

  it('promoted Player rows have classYear=FR, correct teamId, ratings parsed', async () => {
    const newPlayers = await client.player.findMany({
      where: { teamId: teamA, classYear: 'FR', firstName: 'Test' },
    });
    expect(newPlayers.length).toBeGreaterThanOrEqual(3);
    const oh = newPlayers.find((p) => p.position === 'OH');
    expect(oh).toBeTruthy();
    expect(oh!.ratingAttack).toBe(70);
    expect(oh!.ratingBlock).toBe(65);
    expect(oh!.ratingAthleticism).toBe(75);
    expect(oh!.potential).toBe(80);
    expect(oh!.height).toBe(180);
    expect(oh!.redshirtUsed).toBe(false);
  });

  it('isLibero is true only for position=L promoted recruits', async () => {
    const liberos = await client.player.findMany({
      where: { teamId: teamA, classYear: 'FR', position: 'L', firstName: 'Test' },
    });
    expect(liberos.length).toBe(1);
    expect(liberos[0]!.isLibero).toBe(true);
    const ohs = await client.player.findMany({
      where: { teamId: teamA, classYear: 'FR', position: 'OH', firstName: 'Test' },
    });
    expect(ohs[0]!.isLibero).toBe(false);
  });

  it('marks promoted Recruit rows as SIGNED (preserves history; next openRecruitingCycle will delete by seasonYear)', async () => {
    const remainingCommitted = await client.recruit.count({
      where: { commitState: 'COMMITTED' },
    });
    expect(remainingCommitted).toBe(0);
    const signed = await client.recruit.count({
      where: { commitState: 'SIGNED' },
    });
    expect(signed).toBeGreaterThanOrEqual(4);
  });

  it('PENDING recruits flip to UNCOMMITTED (Sprint 13 contract preserved)', async () => {
    const uncommitted = await client.recruit.count({ where: { commitState: 'UNCOMMITTED' } });
    expect(uncommitted).toBeGreaterThanOrEqual(2);
  });

  it('jersey numbers are unique within each team', async () => {
    for (const teamId of [teamA, teamB]) {
      const players = await client.player.findMany({
        where: { teamId },
        select: { jersey: true },
      });
      const jerseys = players.map((p) => p.jersey);
      const unique = new Set(jerseys);
      expect(unique.size).toBe(jerseys.length);
    }
  });

  it('jersey numbers are in the conventional 1..99 range', async () => {
    const newPlayers = await client.player.findMany({
      where: { teamId: teamA, classYear: 'FR' },
    });
    for (const p of newPlayers) {
      expect(p.jersey).toBeGreaterThanOrEqual(1);
      expect(p.jersey).toBeLessThanOrEqual(99);
    }
  });
});
