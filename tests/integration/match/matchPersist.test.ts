// End-to-end match persistence test: seed a slot DB with teams, run the
// main-side simulateAndPersistMatch orchestrator, assert the Match row + PBP
// + box score are persisted and consistent.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { sim } from '@vcd/shared';
import { simulateAndPersistMatch } from '../../../main/src/match/simulateAndPersist';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-matchpersist-'));
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

describe('simulateAndPersistMatch', () => {
  it('persists a Match row with non-null pbp + boxScoreJson', async () => {
    const [home, away] = await client.team.findMany({ take: 2, orderBy: { schoolName: 'asc' } });
    expect(home && away).toBeTruthy();

    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      seed: 'persist-1',
    });

    expect(result.matchId).toBeTruthy();
    expect(result.pbpChars).toBeGreaterThan(0);

    const row = await client.match.findUnique({ where: { id: result.matchId } });
    expect(row).toBeTruthy();
    expect(row!.pbpJson).toBeTruthy();
    expect(row!.boxScoreJson).toBeTruthy();
    expect(row!.winnerId === home!.id || row!.winnerId === away!.id).toBe(true);
  }, 30_000);

  it('replay(pbp) == JSON.parse(boxScoreJson)', async () => {
    const [a, b, c] = await client.team.findMany({ take: 3, orderBy: { abbr: 'asc' } });
    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: b!.id,
      awayTeamId: c!.id,
      seed: 'persist-replay',
    });
    const row = await client.match.findUnique({ where: { id: result.matchId } });
    // Sprint 23: PBP is gzip-base64 by default; decodePbp handles all encodings.
    const pbp = sim.decodePbp(row!.pbpJson!, row!.pbpEncoding);
    expect(row!.pbpEncoding).toBe(sim.PBP_ENCODING_GZIP_BASE64);
    const replayed = sim.replayPbp(pbp);
    const stored = JSON.parse(row!.boxScoreJson!);
    expect(replayed).toEqual(stored);
    expect(a).toBeTruthy(); // silence unused
  }, 30_000);

  // Sprint 23: confirm PBP gzip compression hits the expected ratio in
  // practice (not just the synthetic unit-test fixture).
  it('PBP compresses to ≤30% of plain JSON for a real simulated match', async () => {
    const [home, away] = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      seed: 'compress-real',
    });
    const row = await client.match.findUnique({ where: { id: result.matchId } });
    const pbp = sim.decodePbp(row!.pbpJson!, row!.pbpEncoding);
    const plainJsonSize = JSON.stringify(pbp).length;
    const storedSize = row!.pbpJson!.length;
    const ratio = storedSize / plainJsonSize;
    // eslint-disable-next-line no-console
    console.log(
      `[pbp-compression] plainJson=${plainJsonSize} stored=${storedSize} ratio=${ratio.toFixed(3)}`,
    );
    expect(ratio).toBeLessThanOrEqual(0.3);
  }, 30_000);

  it('rejects same-team matches with INVALID_INPUT', async () => {
    const [team] = await client.team.findMany({ take: 1 });
    await expect(
      simulateAndPersistMatch({
        dbPath,
        homeTeamId: team!.id,
        awayTeamId: team!.id,
        seed: 'same',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('writes per-set rows to the Set table', async () => {
    const [home, away] = await client.team.findMany({ take: 2, orderBy: { abbr: 'desc' } });
    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      seed: 'set-rows',
    });
    const sets = await client.set.findMany({ where: { matchId: result.matchId } });
    expect(sets.length).toBeGreaterThanOrEqual(3);
    expect(sets.length).toBeLessThanOrEqual(5);
  }, 30_000);

  // Sprint 18: PlayerMatchStat row persistence (Sprint 6 carry-forward).
  it('writes 12 PlayerMatchStat rows (6 home + 6 away) per match', async () => {
    const [home, away] = await client.team.findMany({ take: 2, orderBy: { schoolName: 'desc' } });
    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      seed: 'pms-rows',
    });
    const rows = await client.playerMatchStat.findMany({
      where: { matchId: result.matchId },
      include: { player: { select: { teamId: true } } },
    });
    expect(rows).toHaveLength(12);
    const homeRows = rows.filter((r) => r.player.teamId === home!.id);
    const awayRows = rows.filter((r) => r.player.teamId === away!.id);
    expect(homeRows).toHaveLength(6);
    expect(awayRows).toHaveLength(6);
  }, 30_000);

  // Sprint 19: timelineJson persistence (timeouts when useCoachAi=true).
  it('persists timelineJson with parseable MatchTimeline shape', async () => {
    const [home, away] = await client.team.findMany({ take: 2, orderBy: { abbr: 'desc' } });
    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      seed: 'timeline-1',
    });
    const row = await client.match.findUnique({ where: { id: result.matchId } });
    expect(row!.timelineJson).toBeTruthy();
    const parsed = sim.MatchTimelineSchema.parse(JSON.parse(row!.timelineJson!));
    expect(Array.isArray(parsed.timeouts)).toBe(true);
    expect(Array.isArray(parsed.substitutions)).toBe(true);
    // With useCoachAi: true and 5 sets max, expect at least 1 timeout in
    // a typical match — a coach AI usually calls a timeout when the
    // opponent runs 4+. We don't assert ≥1 (it's distribution-dependent),
    // but we assert the array exists and items conform to the schema.
    for (const t of parsed.timeouts) {
      expect(t.setIndex).toBeGreaterThanOrEqual(0);
      expect(t.setIndex).toBeLessThanOrEqual(4);
      expect(['home', 'away']).toContain(t.by);
      expect(t.scoreHome).toBeGreaterThanOrEqual(0);
      expect(t.scoreAway).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);

  it('Σ PlayerMatchStat.kills per side == box-score team kills', async () => {
    const [home, away] = await client.team.findMany({ take: 2, orderBy: { abbr: 'asc' } });
    const result = await simulateAndPersistMatch({
      dbPath,
      homeTeamId: home!.id,
      awayTeamId: away!.id,
      seed: 'pms-invariant',
    });
    const row = await client.match.findUnique({ where: { id: result.matchId } });
    const box = JSON.parse(row!.boxScoreJson!) as sim.MatchBoxScore;
    const playerStats = await client.playerMatchStat.findMany({
      where: { matchId: result.matchId },
      include: { player: { select: { teamId: true } } },
    });
    const homeKills = playerStats
      .filter((r) => r.player.teamId === home!.id)
      .reduce((s, r) => s + r.kills, 0);
    const awayKills = playerStats
      .filter((r) => r.player.teamId === away!.id)
      .reduce((s, r) => s + r.kills, 0);
    expect(homeKills).toBe(box.home.totals.kills);
    expect(awayKills).toBe(box.away.totals.kills);
  }, 30_000);
});
