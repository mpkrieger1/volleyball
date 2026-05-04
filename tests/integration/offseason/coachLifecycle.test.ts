// Sprint 28 Task 28.4: coach lifecycle invariants across 3 offseasons.
//
// - HC always filled per team after each runOffseason.
// - Coach roster turns over (some coaches change between seasons).
// - Determinism: same seed → same churn pattern.

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
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-coach-life-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  // Seed a Season row in NCAA_CHAMP-like state so runOffseason can transition.
  await client.season.upsert({
    where: { year: 2026 },
    create: { year: 2026, phase: 'NCAA_CHAMP', currentWeek: 21 },
    update: { phase: 'NCAA_CHAMP', currentWeek: 21 },
  });
}, 180_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('coach lifecycle (Sprint 28)', () => {
  it('every team has an HC after each offseason (3 cycles)', async () => {
    const teams = await client.team.findMany({ select: { id: true, abbr: true } });
    const hcSnapshots: Array<Map<string, string>> = [];

    for (let i = 0; i < 3; i += 1) {
      // After the first cycle the season phase is PRESEASON; reset it for
      // the next runOffseason call.
      const season = await client.season.findFirst({ orderBy: { year: 'desc' } });
      if (!season) throw new Error('no season');
      if (season.phase !== 'NCAA_CHAMP') {
        await client.season.update({
          where: { id: season.id },
          data: { phase: 'NCAA_CHAMP', currentWeek: 21 },
        });
      }
      await runOffseason({ dbPath, seed: `lifecycle-${i}` });

      // Snapshot HC by team.
      const hcs = await client.coach.findMany({
        where: { role: 'HC' },
        select: { id: true, teamId: true },
      });
      const map = new Map<string, string>();
      for (const c of hcs) {
        if (c.teamId) map.set(c.teamId, c.id);
      }
      hcSnapshots.push(map);

      // Invariant: every team has an HC.
      for (const t of teams) {
        expect(map.get(t.id), `team ${t.abbr} missing HC after cycle ${i}`).toBeDefined();
      }
    }

    // Turnover: at least some HCs should differ between cycles.
    const change01 = countChanges(hcSnapshots[0]!, hcSnapshots[1]!);
    const change12 = countChanges(hcSnapshots[1]!, hcSnapshots[2]!);
    expect(change01 + change12, 'no HC turnover across 3 cycles — RNG too tight?').toBeGreaterThan(0);
  }, 300_000);
});

function countChanges(prev: Map<string, string>, next: Map<string, string>): number {
  let n = 0;
  for (const [team, id] of prev) {
    if (next.get(team) !== id) n += 1;
  }
  return n;
}
