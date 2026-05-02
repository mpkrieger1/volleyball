// PRD Sprint 14 exit tests. Under `npm run test:portal-sim`.
//
// Exit test 1: 8-15% entry rate over full league population.
// Exit test 2: top-quartile NIL wins ≥ 60% head-to-head vs equal peers.
// Exit test 3: no player on two teams simultaneously at any tick.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createRng, portal, recruiting } from '@vcd/shared';
import { openPortal } from '../../../main/src/portal/openPortal';
import { advancePortalWeek } from '../../../main/src/portal/advancePortalWeek';
import { closePortal } from '../../../main/src/portal/closePortal';

const repoRoot = resolve(__dirname, '../../..');

let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-portal-sim-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
  await client.season.create({
    data: { year: 2026, phase: 'OFFSEASON', currentWeek: 0 },
  });
}, 300_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PRD Sprint 14 invariants', () => {
  it('exit test 1: 8-15% of D-I players enter the portal', async () => {
    const totalPlayers = await client.player.count();
    expect(totalPlayers).toBeGreaterThan(4000);

    const result = await openPortal({ dbPath, seed: 'xt1' });
    const rate = result.entrants / totalPlayers;
    // eslint-disable-next-line no-console
    console.log(`entry rate: ${(rate * 100).toFixed(2)}% (${result.entrants}/${totalPlayers})`);
    expect(rate).toBeGreaterThanOrEqual(0.08);
    expect(rate).toBeLessThanOrEqual(0.15);
  }, 120_000);

  it('exit test 3: no player on two teams after closing the cycle', async () => {
    // Advance the cycle from exit-test-1 state to close.
    for (let i = 0; i < 5; i++) {
      await advancePortalWeek({ dbPath, userTeamId: null, seed: `xt3:w${i}` });
    }
    await closePortal({ dbPath });
    // Every Player has exactly one teamId (enforced by schema). Also check
    // that any SIGNED TransferPortal row matches Player.teamId to newTeamId.
    const signed = await client.transferPortal.findMany({
      where: { status: 'SIGNED' },
      include: { player: true },
    });
    for (const s of signed) {
      expect(s.player.teamId).toBe(s.newTeamId);
    }
    // Also: no orphan players (teamId must point to an existing Team).
    const orphaned = await client.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM "Player" WHERE "teamId" NOT IN (SELECT id FROM "Team")',
    );
    expect(Number(orphaned[0]!.count)).toBe(0);
  }, 300_000);

  it('exit test 2: top-quartile NIL offer wins ≥ 60% head-to-head vs equal peer', async () => {
    // Unit-level head-to-head test using pickCommittingTeam directly.
    // Simulates the scenario where two equal-prestige teams pursue one
    // portal target. One offers top-quartile NIL ($20k+), the other
    // offers the baseline ($5k). After identical pursuit weeks they
    // would have similar base interest; the NIL differential should
    // push the NIL-leveraging team to win ≥ 60% of the time.
    const BASELINE_INTEREST = 250; // comparable mid-cycle interest
    const TOP_QUARTILE_NIL_CENTS = 20_000_00;
    const BASELINE_NIL_CENTS = 5_000_00;
    const aInterest = portal.applyNilBump(BASELINE_INTEREST, TOP_QUARTILE_NIL_CENTS);
    const bInterest = portal.applyNilBump(BASELINE_INTEREST, BASELINE_NIL_CENTS);

    let aWins = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const rng = createRng(`nil-h2h:${i}`);
      const picked = recruiting.pickCommittingTeam(rng, [
        { teamId: 'A', interest: aInterest },
        { teamId: 'B', interest: bInterest },
      ]);
      if (picked === 'A') aWins += 1;
    }
    const rate = aWins / N;
    // eslint-disable-next-line no-console
    console.log(
      `NIL h2h: A(${aInterest}) vs B(${bInterest}) → A won ${aWins}/${N} = ${(rate * 100).toFixed(1)}%`,
    );
    expect(rate).toBeGreaterThanOrEqual(0.6);
  });
});
