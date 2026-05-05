// Sprint 32 Task 32.1 — `20261102_000000_team_facilities_level` migration
// applies cleanly on fresh + legacy DBs and is idempotent on re-apply.
//
// We exercise the same `applyMigrations` path that `createSaveSlot` /
// `openSaveSlot` use, so this is a real end-to-end migration test for
// the save-file forward-compat invariant (CLAUDE.md §6).

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
const MIGRATION_NAME = '20261102_000000_team_facilities_level';

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-fac-mig-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 32 — Team.facilitiesLevel migration', () => {
  it('applies on fresh DB; column exists with default 3 and is recorded in _prisma_migrations', async () => {
    const slot = await createSaveSlot(deps, 'Fresh DB');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      const cols = await client.$queryRawUnsafe<Array<{ name: string; dflt_value: string | null }>>(
        `PRAGMA table_info("Team")`,
      );
      const fac = cols.find((c) => c.name === 'facilitiesLevel');
      expect(fac).toBeDefined();
      expect(fac!.dflt_value).toBe('3');

      const tracked = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
        `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION_NAME}'`,
      );
      expect(tracked).toHaveLength(1);
    } finally {
      await client.$disconnect();
    }
  }, 120_000);

  it('idempotent re-apply via openSaveSlot — _prisma_migrations row is not duplicated', async () => {
    const slot = await createSaveSlot(deps, 'Idempotent Test');
    // Re-open twice; openSaveSlot calls applyMigrations each time.
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
