// Sprint 33 Task 33.3 — per-event idempotency.
// Calls a handler twice via raw cursor manipulation and asserts the second
// call doesn't double-apply.

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
import { playersLeaving } from '../../../main/src/offseason/events/playersLeaving';
import { coachCarousel } from '../../../main/src/offseason/events/coachCarousel';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-os-idem-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'Idempotent Test');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 33 — per-event idempotency', () => {
  it('PLAYERS_LEAVING: archive count unchanged on re-run', async () => {
    const r1 = await playersLeaving(client, 2026);
    const archive1 = await client.playerArchive.count({ where: { seasonRetired: 2026 } });
    expect(archive1).toBe(r1.graduated);

    const r2 = await playersLeaving(client, 2026);
    const archive2 = await client.playerArchive.count({ where: { seasonRetired: 2026 } });
    expect(archive2).toBe(archive1);
    expect(r2.graduated).toBe(0); // Skipped on second run.
  }, 120_000);

  it('COACH_CAROUSEL: pool count unchanged on re-run', async () => {
    await coachCarousel(client, 2026);
    const pool1 = await client.coachingPool.count({ where: { seasonAvailable: 2027 } });
    expect(pool1).toBeGreaterThan(0);

    const r2 = await coachCarousel(client, 2026);
    const pool2 = await client.coachingPool.count({ where: { seasonAvailable: 2027 } });
    // Pool refresh is skipped (existing rows for 2027); fills + HC backfill
    // are naturally idempotent (no open slots after first run).
    expect(pool2).toBe(pool1);
    expect(r2.poolGenerated).toBe(0);
  }, 120_000);
});
