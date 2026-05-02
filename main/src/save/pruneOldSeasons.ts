// Sprint 23: PBP retention / save-size enforcement utility.
//
// Shrinks the save DB by removing old-season match data:
//   - Non-tournament Match rows older than the retention window are
//     DELETED entirely (cascade-deletes their Set + PMS rows). Replays
//     and box scores for those matches become unavailable; PlayerArchive
//     preserves season summary stats.
//   - Tournament Match rows in the same window are preserved (so
//     championship history stays viewable) but their pbpJson is nulled
//     and `pbpEncoding` is set to 'pruned'. Replays disappear; box
//     score + final outcome remain.
//
// Idempotent: running twice with the same parameters is a no-op the
// second time.

import type { Prisma, PrismaClient } from '@prisma/client';
import * as pbpCodec from '@vcd/shared/sim/pbpCodec';

type ClientLike = PrismaClient | Prisma.TransactionClient;

export type PruneOldSeasonsInput = {
  /** The current in-game season year. Match rows whose `date.getFullYear()`
   *  is < (currentYear - retainSeasons + 1) are eligible for prune.
   *  Equivalently: keep the most recent `retainSeasons` years inclusive. */
  currentYear: number;
  /** How many years of complete match data to retain (including the
   *  current year). Default 1 = keep current year only. Use 10+ to
   *  effectively disable pruning. */
  retainSeasons: number;
  /** How many years of PlayerArchive rows to retain. Older graduate
   *  records are deleted (their final ratings + season summaries are
   *  lost; the active roster + recent careers remain). Default same
   *  as `retainSeasons`. */
  retainArchiveYears?: number;
};

export type PruneOldSeasonsResult = {
  matchesDeleted: number;
  tournamentMatchesNulled: number;
  archivesDeleted: number;
  recruitsDeleted: number;
  cutoffYear: number;
};

export async function pruneOldSeasons(
  client: ClientLike,
  input: PruneOldSeasonsInput,
): Promise<PruneOldSeasonsResult> {
  const cutoffYear = input.currentYear - input.retainSeasons + 1;

  // Load every match's date + isTournament + current pbpEncoding once.
  // SQLite doesn't expose strftime via Prisma's typed query API, and
  // `date` here is a JS Date column; client-side filtering is fine
  // (~50K rows max in a 10-season save — bounded).
  const matches = await client.match.findMany({
    select: { id: true, date: true, isTournament: true, pbpEncoding: true },
  });

  const olderMatches = matches.filter((m) => m.date.getFullYear() < cutoffYear);
  const regularToDelete = olderMatches.filter((m) => !m.isTournament).map((m) => m.id);
  const tournamentToNull = olderMatches
    .filter((m) => m.isTournament && m.pbpEncoding !== pbpCodec.PBP_ENCODING_PRUNED)
    .map((m) => m.id);

  const archiveCutoffYear =
    input.currentYear - (input.retainArchiveYears ?? input.retainSeasons) + 1;

  let matchesDeleted = 0;
  let tournamentMatchesNulled = 0;
  let archivesDeleted = 0;

  if (regularToDelete.length > 0) {
    // Chunk to avoid SQLite's parameter cap (~999).
    const CHUNK = 500;
    for (let off = 0; off < regularToDelete.length; off += CHUNK) {
      const slice = regularToDelete.slice(off, off + CHUNK);
      const r = await client.match.deleteMany({ where: { id: { in: slice } } });
      matchesDeleted += r.count;
    }
  }

  if (tournamentToNull.length > 0) {
    const CHUNK = 500;
    for (let off = 0; off < tournamentToNull.length; off += CHUNK) {
      const slice = tournamentToNull.slice(off, off + CHUNK);
      const r = await client.match.updateMany({
        where: { id: { in: slice } },
        data: { pbpJson: null, pbpEncoding: pbpCodec.PBP_ENCODING_PRUNED },
      });
      tournamentMatchesNulled += r.count;
    }
  }

  // Prune old PlayerArchive rows. These accumulate at ~1080/season as
  // freshmen-through-graduates cycle, and are the dominant residual bloat
  // after Match prune.
  const oldArchiveResult = await client.playerArchive.deleteMany({
    where: { seasonRetired: { lt: archiveCutoffYear } },
  });
  archivesDeleted = oldArchiveResult.count;

  // Prune old Recruit rows (and their RecruitInterest rows via FK cascade
  // if the schema cascades; otherwise we delete interests first).
  // Recruit grows at ~1500/season (signed + uncommitted) — Sprint 24's
  // recruiting cycle keeps SIGNED rows for analytics until prune sweeps.
  await client.recruitInterest.deleteMany({
    where: { recruit: { seasonYear: { lt: archiveCutoffYear } } },
  });
  const oldRecruitResult = await client.recruit.deleteMany({
    where: { seasonYear: { lt: archiveCutoffYear } },
  });
  const recruitsDeleted = oldRecruitResult.count;

  return {
    matchesDeleted,
    tournamentMatchesNulled,
    archivesDeleted,
    recruitsDeleted,
    cutoffYear,
  };
}
