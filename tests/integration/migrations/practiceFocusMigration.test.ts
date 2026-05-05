// Sprint 34 Task 34.1 — `20261130_000000_practice_focus_picks` migration
// adds the PracticeFocusPick table. Applies cleanly + idempotent.

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
const MIGRATION_NAME = '20261130_000000_practice_focus_picks';

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-pf-mig-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 34 — PracticeFocusPick migration', () => {
  it('creates the PracticeFocusPick table + unique index + secondary index', async () => {
    const slot = await createSaveSlot(deps, 'PF Migration');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
      );
      expect(tables.map((t) => t.name)).toContain('PracticeFocusPick');

      const indexes = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='index'`,
      );
      const idxNames = indexes.map((i) => i.name);
      // Unique key on (seasonYear, week, teamId)
      expect(
        idxNames.some(
          (n) => n.includes('PracticeFocusPick') && n.includes('week') && n.includes('teamId'),
        ),
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
    const slot = await createSaveSlot(deps, 'PF Idempotent');
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
});
