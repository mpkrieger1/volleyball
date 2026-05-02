// PRD Sprint 7 exit tests, asserted against a freshly generated schedule.
//
// **Amendment to exit test 2:** PRD says [28, 32] total per team but strict
// double round-robin for 18-team P4 conferences (ACC, Big Ten) produces 34
// conference matches alone. Plan amended the cap to [28, 40] to preserve the
// CLAUDE.md "every team plays every conference member twice" invariant.

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

describe('PRD Sprint 7 invariants', () => {
  it('every team in every conference plays every other conference member exactly twice (PRD exit 1)', async () => {
    const teams = await client.team.findMany();
    const byConf = new Map<string, typeof teams>();
    for (const t of teams) {
      if (!byConf.has(t.conferenceId)) byConf.set(t.conferenceId, []);
      byConf.get(t.conferenceId)!.push(t);
    }
    // For each conference, pull all matches where BOTH teams are in it.
    for (const [cid, members] of byConf) {
      const memberIds = new Set(members.map((m) => m.id));
      const matches = await client.match.findMany({
        where: {
          homeTeamId: { in: [...memberIds] },
          awayTeamId: { in: [...memberIds] },
          isConference: true,
        },
      });
      const pairCount = new Map<string, number>();
      for (const m of matches) {
        const key = [m.homeTeamId, m.awayTeamId].sort().join('::');
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
      const expected = (members.length * (members.length - 1)) / 2;
      expect(pairCount.size, `${cid} pair count`).toBe(expected);
      for (const [key, count] of pairCount) {
        expect(count, `${cid} ${key}`).toBe(2);
      }
    }
  }, 60_000);

  it('every team has total match count in [28, 40] (PRD exit 2 — amended from 32)', async () => {
    const teams = await client.team.findMany();
    for (const t of teams) {
      const n = await client.match.count({
        where: { OR: [{ homeTeamId: t.id }, { awayTeamId: t.id }] },
      });
      expect(n, `${t.abbr}: ${n}`).toBeGreaterThanOrEqual(28);
      expect(n, `${t.abbr}: ${n}`).toBeLessThanOrEqual(40);
    }
  }, 60_000);

  it('no team is scheduled for two matches on the same date (PRD exit 3)', async () => {
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
});
