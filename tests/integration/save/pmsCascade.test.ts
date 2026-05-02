// Sprint 25 (P1.2): regression test for PlayerMatchStat ON DELETE CASCADE
// from Player. Pre-Sprint-25 the FK was RESTRICT — deleting a Player would
// fail with a foreign-key violation unless the caller manually
// `tx.playerMatchStat.deleteMany` first. The cascade migration makes
// deletion safe by default.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-pms-cascade-'));
  dbPath = join(tmpDir, 'game.db');
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
  execSync(`npx prisma migrate deploy`, { cwd: repoRoot, env, stdio: 'pipe' });
  execSync(`npx tsx prisma/seed.ts`, { cwd: repoRoot, env, stdio: 'pipe' });
  client = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
}, 90_000);

afterAll(async () => {
  await client?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('PlayerMatchStat ON DELETE CASCADE from Player (Sprint 25 P1.2)', () => {
  it('deleting a Player cascades to its PlayerMatchStat rows without raising FK error', async () => {
    // Pick any team and any player on it.
    const player = await client.player.findFirst({ select: { id: true, teamId: true } });
    expect(player).not.toBeNull();
    const teamId = player!.teamId;

    // Need at least 2 teams to satisfy the home/away FK.
    const otherTeam = await client.team.findFirst({
      where: { id: { not: teamId } },
      select: { id: true },
    });
    expect(otherTeam).not.toBeNull();

    // Create a Match + a PMS row referencing this player.
    const match = await client.match.create({
      data: {
        homeTeamId: teamId,
        awayTeamId: otherTeam!.id,
        date: new Date(),
        week: 0,
        isConference: false,
        isTournament: false,
        winnerId: teamId,
      },
      select: { id: true },
    });
    await client.playerMatchStat.create({
      data: {
        playerId: player!.id,
        matchId: match.id,
        kills: 5,
      },
    });
    const before = await client.playerMatchStat.count({ where: { playerId: player!.id } });
    expect(before).toBeGreaterThan(0);

    // Pre-Sprint-25 this would throw P2003 / FK constraint. Post-Sprint-25
    // the cascade absorbs the deletion.
    await expect(
      client.player.delete({ where: { id: player!.id } }),
    ).resolves.toBeTruthy();

    const after = await client.playerMatchStat.count({ where: { playerId: player!.id } });
    expect(after).toBe(0);
  }, 30_000);
});
