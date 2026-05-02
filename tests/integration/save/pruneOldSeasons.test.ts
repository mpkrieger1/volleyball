// Sprint 23 Task 23.6: PBP retention/prune utility.
//
// Strategy: keep the last `retainSeasons` years of full match data
// (Match + Set + PMS rows + uncompressed PBP). For older seasons:
//   - Non-tournament Match rows are deleted entirely (cascade-deletes
//     their Sets + PlayerMatchStats). User loses access to those matches'
//     replay AND box score, but PlayerArchive preserves season summaries.
//   - Tournament Match rows are retained but their `pbpJson` is nulled
//     (`pbpEncoding='pruned'`) so championship history stays viewable
//     in summary form.
// Idempotent: a second call is a no-op.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as pbpCodec from '@vcd/shared/sim/pbpCodec';
import { pruneOldSeasons } from '../../../main/src/save/pruneOldSeasons';

const repoRoot = resolve(__dirname, '../../..');
let tmpDir: string;
let dbPath: string;
let client: PrismaClient;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vcd-prune-'));
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

async function makeMatch(
  year: number,
  isTournament: boolean,
  homeTeamId: string,
  awayTeamId: string,
): Promise<string> {
  const fakePbp = pbpCodec.encodePbp({
    version: 1,
    winner: 'home',
    homeSetsWon: 3,
    awaySetsWon: 0,
    sets: [],
  });
  const m = await client.match.create({
    data: {
      homeTeamId,
      awayTeamId,
      date: new Date(`${year}-09-15T00:00:00Z`),
      week: 0,
      isConference: false,
      isTournament,
      tournamentRound: isTournament ? 'NCAA_CHAMP' : null,
      winnerId: homeTeamId,
      pbpJson: fakePbp.payload,
      pbpEncoding: fakePbp.encoding,
      boxScoreJson: '{}',
    },
  });
  await client.set.create({
    data: { matchId: m.id, index: 0, home: 25, away: 20, durationSec: 1200 },
  });
  return m.id;
}

describe('pruneOldSeasons', () => {
  it('drops non-tournament matches older than (currentYear - retainSeasons + 1)', async () => {
    const teams = await client.team.findMany({ take: 4 });
    const oldRegular = await makeMatch(2026, false, teams[0]!.id, teams[1]!.id);
    const oldTourn = await makeMatch(2026, true, teams[2]!.id, teams[3]!.id);
    const newRegular = await makeMatch(2028, false, teams[0]!.id, teams[1]!.id);

    // Current year 2028, retainSeasons=1 → keep 2028 only.
    const result = await pruneOldSeasons(client, { currentYear: 2028, retainSeasons: 1 });

    // Old regular-season match: row deleted entirely.
    expect(await client.match.findUnique({ where: { id: oldRegular } })).toBeNull();
    expect(await client.set.findFirst({ where: { matchId: oldRegular } })).toBeNull();

    // Old tournament match: row preserved, pbp nulled.
    const tournRow = await client.match.findUnique({ where: { id: oldTourn } });
    expect(tournRow).not.toBeNull();
    expect(tournRow!.pbpJson).toBeNull();
    expect(tournRow!.pbpEncoding).toBe(pbpCodec.PBP_ENCODING_PRUNED);

    // New match: untouched.
    const newRow = await client.match.findUnique({ where: { id: newRegular } });
    expect(newRow).not.toBeNull();
    expect(newRow!.pbpJson).toBeTruthy();
    expect(newRow!.pbpEncoding).toBe(pbpCodec.PBP_ENCODING_GZIP_BASE64);

    expect(result.matchesDeleted).toBeGreaterThanOrEqual(1);
    expect(result.tournamentMatchesNulled).toBeGreaterThanOrEqual(1);
    expect(typeof result.archivesDeleted).toBe('number');
  });

  it('deletes PlayerArchive rows older than retainArchiveYears', async () => {
    const teams = await client.team.findMany({ take: 1 });
    // Two archives: one old (2020), one recent (2030).
    const oldArchive = await client.playerArchive.create({
      data: {
        originalPlayerId: 'orig-old-1',
        firstName: 'Old',
        lastName: 'Player',
        position: 'OH',
        finalTeamId: teams[0]!.id,
        finalClassYear: 'SR',
        finalRatingsJson: '{}',
        finalPotential: 70,
        seasonRetired: 2020,
      },
    });
    const recentArchive = await client.playerArchive.create({
      data: {
        originalPlayerId: 'orig-new-1',
        firstName: 'Recent',
        lastName: 'Player',
        position: 'OH',
        finalTeamId: teams[0]!.id,
        finalClassYear: 'SR',
        finalRatingsJson: '{}',
        finalPotential: 70,
        seasonRetired: 2031,
      },
    });

    // currentYear=2032, retainArchiveYears=3 → keep seasonRetired >= 2030.
    const result = await pruneOldSeasons(client, {
      currentYear: 2032,
      retainSeasons: 1,
      retainArchiveYears: 3,
    });
    expect(await client.playerArchive.findUnique({ where: { id: oldArchive.id } })).toBeNull();
    expect(
      await client.playerArchive.findUnique({ where: { id: recentArchive.id } }),
    ).not.toBeNull();
    expect(result.archivesDeleted).toBeGreaterThanOrEqual(1);
  });

  it('is idempotent — a second call is a no-op', async () => {
    const result2 = await pruneOldSeasons(client, { currentYear: 2028, retainSeasons: 1 });
    expect(result2.matchesDeleted).toBe(0);
    expect(result2.tournamentMatchesNulled).toBe(0);
  });

  it('with retainSeasons=10 keeps everything', async () => {
    const teams = await client.team.findMany({ take: 2 });
    const id = await makeMatch(2025, false, teams[0]!.id, teams[1]!.id);
    const result = await pruneOldSeasons(client, { currentYear: 2030, retainSeasons: 10 });
    expect(await client.match.findUnique({ where: { id } })).not.toBeNull();
    expect(result.matchesDeleted).toBe(0);
  });
});
