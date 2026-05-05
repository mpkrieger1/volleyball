// Sprint 35 Task 35.3 — backfill priorities + academics + coach hometown.

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
import { backfillRecruitingCore } from '../../../main/src/saveSlots/backfillRecruitingCore';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-rc-back-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'RC Backfill');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 35 — backfillRecruitingCore', () => {
  it('synthesizes priorities for legacy Recruit rows (idempotent)', async () => {
    // Insert 50 synthetic legacy recruits with NULL priorities.
    const legacyRows: Array<{ id: string; index: number }> = [];
    for (let i = 0; i < 50; i++) {
      legacyRows.push({ id: `legacy-recruit-${i}`, index: i });
    }
    await client.$transaction(
      legacyRows.map((r) =>
        client.recruit.create({
          data: {
            id: r.id,
            firstName: `First${r.index}`,
            lastName: `Last${r.index}`,
            position: 'OH',
            stars: 3,
            ratingsJson: '{"attack":60,"block":60,"serve":60,"pass":60,"set":60,"dig":60,"athleticism":60,"iq":60,"stamina":60}',
            commitState: 'PENDING',
            seasonYear: 2026,
          },
        }),
      ),
    );

    const result1 = await backfillRecruitingCore(client, repoRoot);
    expect(result1.recruitsBackfilled).toBe(50);

    const samples = await client.recruit.findMany({
      where: { id: { in: legacyRows.slice(0, 5).map((r) => r.id) } },
      select: { prioritiesJson: true, wantsToLeaveHome: true },
    });
    for (const s of samples) {
      expect(s.prioritiesJson).not.toBeNull();
      const p = JSON.parse(s.prioritiesJson!);
      for (const k of ['playingTime', 'proximityToHome', 'prestige', 'facilities', 'nilDeal']) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(10);
      }
    }

    // Re-run: idempotent (no new recruits to backfill).
    const result2 = await backfillRecruitingCore(client, repoRoot);
    expect(result2.recruitsBackfilled).toBe(0);
  }, 120_000);

  it('seeds Team.academicsLevel from CSV (Stanford ≥ 90; non-listed teams stay at 50)', async () => {
    // Stanford is in the CSV.
    const stan = await client.team.findFirst({ where: { abbr: 'STAN' } });
    expect(stan).not.toBeNull();
    expect(stan!.academicsLevel).toBeGreaterThanOrEqual(90);

    // A team NOT in the CSV (we'll use the first team that is NOT in the list)
    const ALL_LISTED = new Set([
      'STAN', 'NW', 'DUKE', 'VAN', 'BYU', 'ND', 'WAKE', 'RICE',
      'MICH', 'UVA', 'CAL', 'UCLA', 'FLA', 'GT', 'BC', 'MSU', 'VT', 'FSU', 'LOU', 'MIA', 'WVU', 'USF',
    ]);
    const notListed = await client.team.findFirst({
      where: { abbr: { notIn: Array.from(ALL_LISTED) } },
    });
    expect(notListed).not.toBeNull();
    expect(notListed!.academicsLevel).toBe(50);
  }, 60_000);

  it('every coach has a non-null hometownState (2-letter US state)', async () => {
    const coaches = await client.coach.findMany({
      where: { teamId: { not: null } },
      select: { hometownState: true },
      take: 100,
    });
    for (const c of coaches) {
      expect(c.hometownState).not.toBeNull();
      expect(c.hometownState).toMatch(/^[A-Z]{2}$/);
    }
  }, 60_000);
});
