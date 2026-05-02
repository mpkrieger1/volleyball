// Sprint 25 (P0.5): forward-compat migration on save-slot open.
//
// Scenario: a user created a save with VCD vN. The next release vN+1
// includes a new schema migration. When the user opens the legacy save
// with vN+1, `openSaveSlot` must apply the new migration before
// returning. CLAUDE.md §Critical rule 6: "A save created in sprint N
// must open in sprint N+1."
//
// Verifies the migration-tracking contract:
//   1. `createSaveSlot` populates `_prisma_migrations` with every
//      on-disk migration folder.
//   2. `openSaveSlot` re-runs `applyMigrations`, which is idempotent
//      (already-applied migrations are skipped via the tracking table)
//      and surfaces no errors.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  createSaveSlot,
  openSaveSlot,
  findSlotDbPathById,
  listSaveSlots,
  type SaveSlotServiceDeps,
} from '../../../main/src/saveSlots/service';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-savecompat-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Save forward-compat — applyMigrations is idempotent + tracked', () => {
  it('createSaveSlot populates _prisma_migrations and includes the Sprint 25 PMS cascade', async () => {
    const slot = await createSaveSlot(deps, 'Tracking Test');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const rows = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
        `SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`,
      );
      expect(rows.length).toBeGreaterThan(5);
      expect(rows.some((r) => r.migration_name.includes('pms_player_cascade'))).toBe(true);
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('openSaveSlot is idempotent — re-applying migrations on open does not error', async () => {
    // Open the slot a second time. `applyMigrations` runs again; every
    // folder is in the tracking table and gets skipped.
    const slots = await listSaveSlots(deps);
    expect(slots.length).toBeGreaterThan(0);
    const slotId = slots[0]!.id;

    const opened1 = await openSaveSlot(deps, slotId);
    expect(opened1.id).toBe(slotId);
    const opened2 = await openSaveSlot(deps, slotId);
    expect(opened2.id).toBe(slotId);
    expect(new Date(opened2.lastOpenedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(opened1.lastOpenedAt).getTime(),
    );

    // Verify _prisma_migrations is unchanged (no duplicates inserted).
    const dbPath = await findSlotDbPathById(deps, slotId);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const rows = await client.$queryRawUnsafe<Array<{ migration_name: string; c: bigint }>>(
        `SELECT migration_name, COUNT(*) as c FROM "_prisma_migrations" GROUP BY migration_name HAVING c > 1`,
      );
      expect(rows.length).toBe(0);
    } finally {
      await client.$disconnect();
    }
  }, 180_000);
});
