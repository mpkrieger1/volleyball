// Sprint 32 Task 32.1 — legacy-save backfill bumps facilitiesLevel from
// the column-default 3 to the prestige-derived value. Re-runs are no-ops.

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
import { backfillFacilitiesLevel } from '../../../main/src/saveSlots/backfillFacilitiesLevel';
import { deriveFacilitiesLevel } from '@vcd/shared/seed';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-fac-backfill-'));
  deps = { repoRoot, baseDir: tmpDir };
}, 90_000);

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 32 — backfillFacilitiesLevel', () => {
  it('bumps high-prestige teams from default 3 to tier-derived value; idempotent on re-run', async () => {
    const slot = await createSaveSlot(deps, 'Backfill Test');
    const dbPath = await findSlotDbPathById(deps, slot.id);
    expect(dbPath).not.toBeNull();
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbPath!}` } } });
    try {
      // Simulate a legacy save: every team is at the column-default 3,
      // as if `applyMigrations` just added the column on a pre-S32 DB.
      await client.team.updateMany({ data: { facilitiesLevel: 3 } });

      // First run: high-prestige teams get bumped above 3.
      const updated1 = await backfillFacilitiesLevel(client);
      expect(updated1).toBeGreaterThan(0);

      const teams = await client.team.findMany({
        select: { prestige: true, facilitiesLevel: true },
      });
      for (const t of teams) {
        expect(t.facilitiesLevel).toBe(deriveFacilitiesLevel(t.prestige));
      }

      // Re-run: no rows still at default 3 with target > 3, so updated === 0.
      const updated2 = await backfillFacilitiesLevel(client);
      expect(updated2).toBe(0);

      // Final state unchanged after second run.
      const teams2 = await client.team.findMany({
        select: { prestige: true, facilitiesLevel: true },
      });
      for (const t of teams2) {
        expect(t.facilitiesLevel).toBe(deriveFacilitiesLevel(t.prestige));
      }
    } finally {
      await client.$disconnect();
    }
  }, 180_000);
});
