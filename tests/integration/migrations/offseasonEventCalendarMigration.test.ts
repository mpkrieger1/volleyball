// Sprint 33 Task 33.1 — `20261116_000000_offseason_event_calendar` migration
// adds Season.phaseWeek + TrainingFocusPick + TrainingResultEntry. Applies
// cleanly on fresh + legacy DBs and is idempotent on re-apply.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  createSaveSlot,
  openSaveSlot,
  findSlotDbPathById,
  type SaveSlotServiceDeps,
} from '../../../main/src/saveSlots/service';

const repoRoot = resolve(__dirname, '../../..');
const MIGRATION_NAME = '20261116_000000_offseason_event_calendar';

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-os-mig-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 33 — offseason event-calendar migration', () => {
  it('adds Season.phaseWeek (default 0) + TrainingFocusPick + TrainingResultEntry', async () => {
    const slot = await createSaveSlot(deps, 'Fresh DB');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const seasonCols = await client.$queryRawUnsafe<
        Array<{ name: string; dflt_value: string | null }>
      >(`PRAGMA table_info("Season")`);
      const phaseWeek = seasonCols.find((c) => c.name === 'phaseWeek');
      expect(phaseWeek).toBeDefined();
      expect(phaseWeek!.dflt_value).toBe('0');

      const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      );
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('TrainingFocusPick');
      expect(tableNames).toContain('TrainingResultEntry');

      const indexes = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='index'`,
      );
      const idxNames = indexes.map((i) => i.name);
      // Unique key on TrainingFocusPick(seasonYear, teamId, coachId, slotIndex)
      expect(
        idxNames.some((n) => n.includes('TrainingFocusPick') && n.includes('coachId')),
      ).toBe(true);
      // Index on TrainingResultEntry(playerId)
      expect(
        idxNames.some((n) => n.includes('TrainingResultEntry') && n.includes('playerId')),
      ).toBe(true);

      const tracked = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
        `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION_NAME}'`,
      );
      expect(tracked).toHaveLength(1);
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('idempotent re-apply via openSaveSlot — _prisma_migrations not duplicated', async () => {
    const slot = await createSaveSlot(deps, 'Idempotent Test');
    await openSaveSlot(deps, slot.id);
    await openSaveSlot(deps, slot.id);

    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const dupes = await client.$queryRawUnsafe<Array<{ migration_name: string; c: bigint }>>(
        `SELECT migration_name, COUNT(*) as c FROM "_prisma_migrations" GROUP BY migration_name HAVING c > 1`,
      );
      expect(dupes).toHaveLength(0);
    } finally {
      await client.$disconnect();
    }
  }, 180_000);

  it('Season.phaseWeek defaults to 0 on legacy save', async () => {
    const slot = await createSaveSlot(deps, 'Legacy Default Test');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const seasons = await client.season.findMany();
      for (const s of seasons) {
        expect(s.phaseWeek).toBe(0);
      }
    } finally {
      await client.$disconnect();
    }
  }, 120_000);
});
