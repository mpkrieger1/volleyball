// Sprint 33 Task 33.4 — repeated-focus multiplier validation.
//
// Three coaches × three slots, all 9 picks targeting the SAME attribute:
// expected gain ratio across the 3 effective repeated-focus tiers
// (n=0: 1.0×, n=1: 0.6×, n=2..: 0.4×/0.2×). Per CLAUDE.md §1, seeded RNG
// only — never Math.random.
//
// Sprint 32 multiplier table: 0→1.0, 1→0.6, 2→0.4, 3+→0.2.
// We seed each TrainingFocusPick with the SAME attribute across all 9
// slots and observe per-slot gain magnitudes.

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
import { applyTrainingResults } from '../../../main/src/offseason/applyTrainingResults';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-rfp-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'Repeated Focus');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 33 — repeated-focus penalty in practice', () => {
  it('repeated-focus multiplier reduces effective gain at higher slot indices', async () => {
    // Pick a single team; force all 3 HC slots to target the SAME attribute.
    // 'athleticism' is in the HC pool. AHC + AC will use AI heuristic.
    const team = await client.team.findFirstOrThrow();
    const hc = await client.coach.findFirstOrThrow({ where: { teamId: team.id, role: 'HC' } });

    // Reset any rating mutations from happenstance.
    await client.player.updateMany({
      where: { teamId: team.id },
      data: { ratingAthleticism: 50, potential: 90 },
    });

    await client.trainingFocusPick.createMany({
      data: [0, 1, 2].map((slotIndex) => ({
        seasonYear: 2026,
        teamId: team.id,
        coachId: hc.id,
        slotIndex,
        attribute: 'athleticism',
      })),
    });

    await applyTrainingResults({ client, seasonYear: 2026 });

    const entries = await client.trainingResultEntry.findMany({
      where: { seasonYear: 2026, teamId: team.id, attribute: 'athleticism', gainApplied: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.length).toBeGreaterThan(0);

    // Group by player to identify slot order: each player has 3 entries
    // in slot order (insertion order matches our outer slot loop in
    // applyTrainingResults).
    const byPlayer = new Map<string, number[]>();
    for (const e of entries) {
      const arr = byPlayer.get(e.playerId) ?? [];
      arr.push(e.gainApplied);
      byPlayer.set(e.playerId, arr);
    }

    // Across all players, mean slot-0 gain should exceed mean slot-1 gain
    // (1.0× vs 0.6×) and slot-1 ≥ slot-2 (0.6× vs 0.4×).
    let sum0 = 0,
      sum1 = 0,
      sum2 = 0,
      n = 0;
    for (const arr of byPlayer.values()) {
      if (arr.length < 3) continue;
      sum0 += arr[0]!;
      sum1 += arr[1]!;
      sum2 += arr[2]!;
      n += 1;
    }
    expect(n).toBeGreaterThan(0);
    const mean0 = sum0 / n;
    const mean1 = sum1 / n;
    const mean2 = sum2 / n;
    expect(mean0).toBeGreaterThan(mean1);
    expect(mean1).toBeGreaterThanOrEqual(mean2);
  }, 240_000);
});
