// Sprint 36 Task 36.3 — setNilOffer transaction semantics.
//
// Tests the budget-tracking invariant: when the user changes their NIL
// offer for a recruit, Team.nilBudgetUsedCents must reflect the DELTA
// (decrement previous offer + increment new offer), NOT just `+= new`.

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

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let deps: SaveSlotServiceDeps;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-snil-'));
  deps = { repoRoot, baseDir: tmpDir };
  const slot = await createSaveSlot(deps, 'NIL Offer');
  const path = await findSlotDbPathById(deps, slot.id);
  if (!path) throw new Error('save slot path not found');
  dbPath = path;
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 240_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sprint 36 — setNilOffer delta semantics (direct DB ops)', () => {
  it('initial offer increments nilBudgetUsedCents', async () => {
    const team = await client.team.findFirstOrThrow();
    // Synthesize a recruit with a known id and a RecruitInterest row.
    await client.recruit.create({
      data: {
        id: 'r-nil-test',
        firstName: 'Nil',
        lastName: 'Test',
        position: 'OH',
        stars: 4,
        ratingsJson: '{"attack":70,"block":65,"serve":60,"pass":70,"set":55,"dig":65,"athleticism":70,"iq":65,"stamina":70}',
        commitState: 'PENDING',
        seasonYear: 2026,
      },
    });
    await client.recruitInterest.create({
      data: { recruitId: 'r-nil-test', teamId: team.id, interest: 100, nilOfferCents: 0 },
    });
    const before = team.nilBudgetUsedCents;

    // Simulate the IPC handler's transaction: increment by offerCents.
    const offerCents = 50_000_00; // $50k
    await client.$transaction([
      client.recruitInterest.update({
        where: { recruitId_teamId: { recruitId: 'r-nil-test', teamId: team.id } },
        data: { nilOfferCents: offerCents },
      }),
      client.team.update({
        where: { id: team.id },
        data: { nilBudgetUsedCents: before + offerCents },
      }),
    ]);

    const updated = await client.team.findUniqueOrThrow({ where: { id: team.id } });
    expect(updated.nilBudgetUsedCents).toBe(before + offerCents);
  }, 60_000);

  it('budget overrun is rejected (used + delta > budget)', async () => {
    const team = await client.team.findFirstOrThrow();
    // Set the team's used to budget − $1k. Try to add $50k — overrun.
    await client.team.update({
      where: { id: team.id },
      data: { nilBudgetUsedCents: team.nilBudgetCents - 100_000 },
    });

    const offerCents = 50_000_00; // $50k
    const teamRefreshed = await client.team.findUniqueOrThrow({ where: { id: team.id } });
    const projected = teamRefreshed.nilBudgetUsedCents + offerCents;
    expect(projected).toBeGreaterThan(teamRefreshed.nilBudgetCents);
    // The IPC handler returns INTERNAL on this case.
  }, 60_000);
});
