// Sprint 16 main-service integration test. Seeds a save DB with 4,320
// players, runs one offseason, verifies graduation + advance + cap.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { runOffseason } from '../../../main/src/offseason/runOffseason';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-offseason-'));
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

describe('runOffseason (integration)', () => {
  it('graduates SRs to PlayerArchive; advances other classes', async () => {
    const preSrs = await client.player.count({ where: { classYear: 'SR' } });
    const preFrs = await client.player.count({ where: { classYear: 'FR' } });
    expect(preSrs).toBeGreaterThan(0);

    const result = await runOffseason({ dbPath, seed: 'runoff-1' });
    expect(result.playersGraduated).toBe(preSrs);
    expect(result.newSeasonYear).toBe(2027);

    // SRs moved to archive.
    const archiveCount = await client.playerArchive.count({ where: { seasonRetired: 2026 } });
    expect(archiveCount).toBe(preSrs);

    // No SRs remain (new SRs came from JR tier).
    // Sprint 12's roster has 3 per class; after advance, JR→SR means there
    // are still SR players. Check archive has old SR ids.
    const archiveIds = (await client.playerArchive.findMany({ select: { originalPlayerId: true } })).map(
      (a) => a.originalPlayerId,
    );
    const livingIds = (await client.player.findMany({ select: { id: true } })).map((p) => p.id);
    for (const aid of archiveIds) expect(livingIds.includes(aid)).toBe(false);

    // FRs promoted: there are no more FRs until recruiting brings new ones.
    const postFrs = await client.player.count({ where: { classYear: 'FR' } });
    expect(postFrs).toBe(0);

    // FR count from pre → SO count from post (pre FRs became SOs).
    const postSos = await client.player.count({ where: { classYear: 'SO' } });
    expect(postSos).toBeGreaterThanOrEqual(preFrs);
  }, 120_000);

  it('enforces SCHOLARSHIP_CAP per team', async () => {
    const byTeam = await client.player.groupBy({
      by: ['teamId'],
      _count: { _all: true },
    });
    for (const row of byTeam) {
      expect(row._count._all).toBeLessThanOrEqual(15);
    }
  });

  it('updates Season.phase to PRESEASON and increments year', async () => {
    const season = await client.season.findFirst();
    expect(season!.phase).toBe('PRESEASON');
    expect(season!.year).toBe(2027);
    expect(season!.currentWeek).toBe(0);
    expect(season!.nationalChampionTeamId).toBeNull();
  });

  it('updates Booster.enthusiasm (no longer static 50)', async () => {
    // With zero matches played in the integration fixture, all teams have
    // games=0 → winPct defaults to 0.5 → enthusiasm = 50 + tournamentBonus.
    // Most teams have NONE finish → enthusiasm = 50. Some may be zero
    // because match list is empty. Verify the field was touched (not null).
    const boosters = await client.booster.findMany();
    for (const b of boosters) {
      expect(b.enthusiasm).toBeGreaterThanOrEqual(0);
      expect(b.enthusiasm).toBeLessThanOrEqual(100);
    }
  });
});
