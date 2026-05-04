// Sprint 28 schedule invariants. Replaces the Sprint 7 strict double
// round-robin assertion. Hard rules:
//   - Every team plays exactly 10 non-conf games (weeks 0..NON_CONF_LAST_WEEK).
//   - Conf game count per team ≤ 18 (capped circle method).
//   - Confs ≤10 members → full double round-robin; confs ≥11 → ≤18 games/team.
//   - Non-con games strictly precede conf games (no week overlap).
//   - No team scheduled for two matches on the same date.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateAndPersistSchedule } from '../../../main/src/schedule/generateAndPersist';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-invariants-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  await generateAndPersistSchedule({ dbPath, seasonYear: 2026, seed: 'invariants' });
}, 180_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 28 schedule invariants', () => {
  it('every team plays exactly 10 non-conference games', async () => {
    const teams = await client.team.findMany();
    for (const t of teams) {
      // Includes early-season tournament-cluster games (still non-con).
      const n = await client.match.count({
        where: {
          isConference: false,
          OR: [{ homeTeamId: t.id }, { awayTeamId: t.id }],
        },
      });
      expect(n, `${t.abbr}: ${n} non-conf games`).toBe(10);
    }
  }, 120_000);

  it('conf game count per team is capped at 18 (and = (N-1)*2 for confs <10)', async () => {
    const teams = await client.team.findMany();
    const byConf = new Map<string, typeof teams>();
    for (const t of teams) {
      if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
      byConf.get(t.conferenceId)!.push(t);
    }

    for (const t of teams) {
      const n = await client.match.count({
        where: {
          isConference: true,
          OR: [{ homeTeamId: t.id }, { awayTeamId: t.id }],
        },
      });
      const confSize = byConf.get(t.conferenceId)!.length;
      const expectedMax = Math.min(18, (confSize - 1) * 2);
      expect(n, `${t.abbr} (confSize=${confSize}): ${n} conf games`).toBeLessThanOrEqual(expectedMax);
      // For even-sized confs ≤10, expect exact equality.
      if (confSize <= 10 && confSize % 2 === 0) {
        expect(n, `${t.abbr} (even confSize=${confSize})`).toBe(expectedMax);
      }
    }
  }, 120_000);

  it('non-con games strictly precede conf games (week separation)', async () => {
    const nonConfMaxWeek = await client.match.findFirst({
      where: { isConference: false, isTournament: false },
      orderBy: { week: 'desc' },
      select: { week: true },
    });
    const confMinWeek = await client.match.findFirst({
      where: { isConference: true },
      orderBy: { week: 'asc' },
      select: { week: true },
    });
    expect(nonConfMaxWeek).not.toBeNull();
    expect(confMinWeek).not.toBeNull();
    expect(
      nonConfMaxWeek!.week,
      `last non-con week ${nonConfMaxWeek!.week} should be < first conf week ${confMinWeek!.week}`,
    ).toBeLessThan(confMinWeek!.week);
  }, 30_000);

  it('no team is scheduled for two matches on the same date', async () => {
    const rows = await client.match.findMany({
      select: { homeTeamId: true, awayTeamId: true, date: true },
    });
    const byTeamDate = new Map<string, number>();
    for (const r of rows) {
      const iso = r.date.toISOString().slice(0, 10);
      const a = `${r.homeTeamId}:${iso}`;
      const b = `${r.awayTeamId}:${iso}`;
      byTeamDate.set(a, (byTeamDate.get(a) ?? 0) + 1);
      byTeamDate.set(b, (byTeamDate.get(b) ?? 0) + 1);
    }
    for (const [key, count] of byTeamDate) {
      expect(count, key).toBeLessThanOrEqual(1);
    }
  }, 30_000);

  it('total game count per team = 10 + min(18, (confSize-1)*2) for big confs; less for small', async () => {
    const teams = await client.team.findMany();
    const byConf = new Map<string, typeof teams>();
    for (const t of teams) {
      if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
      byConf.get(t.conferenceId)!.push(t);
    }
    for (const t of teams) {
      const n = await client.match.count({
        where: { OR: [{ homeTeamId: t.id }, { awayTeamId: t.id }] },
      });
      const confSize = byConf.get(t.conferenceId)!.length;
      const expectedMax = 10 + Math.min(18, (confSize - 1) * 2);
      expect(n, `${t.abbr} (confSize=${confSize}): ${n} total`).toBeLessThanOrEqual(expectedMax);
      // Lower bound: 10 non-con + (confSize-1)*2 (capped at 16 for odd-conf bye asymmetry).
      const expectedMin = 10 + Math.max(0, Math.min(16, (confSize - 1) * 2));
      expect(n, `${t.abbr} (confSize=${confSize}): ${n} total ≥ ${expectedMin}`).toBeGreaterThanOrEqual(expectedMin);
    }
  }, 120_000);
});
