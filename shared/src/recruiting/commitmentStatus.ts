// Sprint 35 Task 35.5 — derive a recruit's commitment status from their
// interest distribution + cycle week. Port-adapted from FCCD's
// `RecruitCommitmentStatus`.
//
// Rules (from spec §35.5):
//   COMMITTED          — commitState === 'COMMITTED' (delegates).
//   WILL_COMMIT_SOON   — top interest ≥ 80 AND lead over #2 ≥ 15.
//   FAVORITES          — top-3 interests all ≥ 60.
//   NARROWING          — top-3 interests all ≥ 40.
//   EXPLORING          — otherwise.
//
// Pure function; recomputed at the end of each `advanceRecruitingWeek`
// call and persisted in `Recruit.commitmentStatus`.

export type CommitmentStatus =
  | 'EXPLORING'
  | 'NARROWING'
  | 'FAVORITES'
  | 'WILL_COMMIT_SOON'
  | 'COMMITTED';

export type CommitState =
  | 'PENDING'
  | 'COMMITTED'
  | 'UNCOMMITTED'
  | 'SIGNED';

export interface DeriveCommitmentStatusArgs {
  /** Top-3 interest values, sorted desc. Pads with 0 if fewer than 3. */
  topThreeInterest: number[];
  /** Cycle week 1..12. v1.2 doesn't use this; reserved for v1.3 (recruits
   *  late in the cycle should advance status faster). */
  weekInCycle: number;
  stars: number;
  commitState: CommitState;
}

const WILL_COMMIT_SOON_TOP = 80;
const WILL_COMMIT_SOON_LEAD = 15;
const FAVORITES_FLOOR = 60;
const NARROWING_FLOOR = 40;

export function deriveCommitmentStatus(args: DeriveCommitmentStatusArgs): CommitmentStatus {
  if (args.commitState === 'COMMITTED') return 'COMMITTED';

  // Pad to 3 entries with 0s if the recruit has fewer pursuing teams.
  const top = [...args.topThreeInterest, 0, 0, 0].slice(0, 3);
  const [a, b, c] = top as [number, number, number];

  if (a >= WILL_COMMIT_SOON_TOP && a - b >= WILL_COMMIT_SOON_LEAD) {
    return 'WILL_COMMIT_SOON';
  }
  if (a >= FAVORITES_FLOOR && b >= FAVORITES_FLOOR && c >= FAVORITES_FLOOR) {
    return 'FAVORITES';
  }
  if (a >= NARROWING_FLOOR && b >= NARROWING_FLOOR && c >= NARROWING_FLOOR) {
    return 'NARROWING';
  }
  return 'EXPLORING';
}
