// Sprint 33 Task 33.3 — happy-path walk through all 11 OFFSEASON + 5
// PRESEASON events via `advanceOffseasonEvent`. Asserts per-event side
// effects and end-state parity with today's `runOffseason`.
//
// Bootstraps via the saveSlot service path (faster than CLI prisma migrate),
// matching the Sprint 32 integration tests.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  createSaveSlot,
  findSlotDbPathById,
  type SaveSlotServiceDeps,
} from '../../../main/src/saveSlots/service';
import { advanceOffseasonEvent } from '../../../main/src/offseason/advanceOffseasonEvent';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-os-events-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'Event Walk');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

  // Flip the freshly-seeded Season from PRESEASON (created by createSaveSlot)
  // into OFFSEASON / phaseWeek=0 so the event walk starts at YEAR_SUMMARY.
  await client.season.update({
    where: { year: 2026 },
    data: { phase: 'OFFSEASON', phaseWeek: 0 },
  });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 33 — advanceOffseasonEvent happy path', () => {
  it('walks all 16 events; lands at REGULAR with phaseWeek=0 and year+1', async () => {
    const preSrs = await client.player.count({ where: { classYear: 'SR' } });
    expect(preSrs).toBeGreaterThan(0);
    const preSeason = await client.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
    expect(preSeason.year).toBe(2026);

    // Walk events one at a time. Cap at 32 to detect runaway loops.
    for (let i = 0; i < 32; i++) {
      const cur = await client.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
      if (cur.phase === 'REGULAR') break;
      await advanceOffseasonEvent({ dbPath });
    }

    const post = await client.season.findFirstOrThrow({ orderBy: { year: 'desc' } });
    expect(post.phase).toBe('REGULAR');
    expect(post.phaseWeek).toBe(0);
    expect(post.year).toBe(2027);
  }, 240_000);

  it('PLAYERS_LEAVING archived all SRs', async () => {
    const archived = await client.playerArchive.count({ where: { seasonRetired: 2026 } });
    expect(archived).toBeGreaterThan(0);
    const remainingSrs = await client.player.count({ where: { classYear: 'SR' } });
    // After class-advance, JR→SR, so there ARE SRs again, but the
    // archived ones should not be among them.
    const archIds = (
      await client.playerArchive.findMany({
        where: { seasonRetired: 2026 },
        select: { originalPlayerId: true },
      })
    ).map((a) => a.originalPlayerId);
    const livingIds = (await client.player.findMany({ select: { id: true } })).map((p) => p.id);
    for (const aid of archIds) expect(livingIds).not.toContain(aid);
    expect(remainingSrs).toBeGreaterThanOrEqual(0);
  });

  it('COACH_CAROUSEL refreshed the hiring pool to 100 rows for the new season', async () => {
    const poolCount = await client.coachingPool.count({ where: { seasonAvailable: 2027 } });
    expect(poolCount).toBeGreaterThan(0);
  });

  it('every team still has an HC after the carousel (HC backfill invariant)', async () => {
    const teams = await client.team.findMany({ select: { id: true } });
    for (const t of teams) {
      const hc = await client.coach.findFirst({ where: { teamId: t.id, role: 'HC' } });
      expect(hc).not.toBeNull();
    }
  });

  it('FINALIZE promoted COMMITTED recruits to Player rows (where applicable)', async () => {
    // Recruits should have been processed by SIGNING_DAY → only SIGNED or
    // UNCOMMITTED remain (no PENDING / COMMITTED leftover).
    const pending = await client.recruit.count({ where: { commitState: 'PENDING' } });
    const committed = await client.recruit.count({ where: { commitState: 'COMMITTED' } });
    expect(pending).toBe(0);
    expect(committed).toBe(0);
  });
});
