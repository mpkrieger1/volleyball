// Sprint 13: commit resolution.
//
// When a PENDING recruit reaches their decision threshold, they pick
// the team they'll commit to via a weighted random draw over the top-3
// teams by interest. Weights are `interest²` for sharpness — the
// leader usually wins, but dark horses aren't zero.
//
// Decision timing: lower-star recruits decide earlier (eager to lock
// in), higher-star recruits wait until late in the cycle. A "hot"
// recruit (maxInterest > HOT_THRESHOLD) commits sooner.

import type { Rng } from '../rng';

export type InterestRow = { teamId: string; interest: number };

/** Recruits with at least this max-interest are eligible to decide early. */
export const HOT_INTEREST_THRESHOLD = 600;
/** Recruits with no live interest bail at this interest (uncommitted). */
export const INTEREST_FLOOR = 30;

/**
 * Decide whether a PENDING recruit commits THIS week, given cycle week
 * (1..12), star rating, and max interest across all pursuing teams.
 *
 * Rule of thumb:
 *   - 1–2 star: may decide from week 3 onward at any non-trivial interest
 *   - 3 star:   week 5+
 *   - 4 star:   week 7+ (or 4+ if HOT)
 *   - 5 star:   week 9+ (or 6+ if HOT)
 */
export function shouldDecide(
  week: number,
  stars: 1 | 2 | 3 | 4 | 5,
  maxInterest: number,
): boolean {
  if (maxInterest < INTEREST_FLOOR) return false;
  const hot = maxInterest >= HOT_INTEREST_THRESHOLD;
  const thresholds: Record<number, [number, number]> = {
    1: [3, 2],
    2: [3, 2],
    3: [5, 3],
    4: [7, 4],
    5: [9, 6],
  };
  const [normal, hotWeek] = thresholds[stars]!;
  const threshold = hot ? hotWeek : normal;
  return week >= threshold;
}

/**
 * Pick a committing team from the top-3 interest entries.
 * Weights are interest² so the leader has a meaningful edge but
 * second/third place still win occasionally (exit-test 3 depends on
 * this variance across 100 sims).
 *
 * Returns null if no team has enough interest (< INTEREST_FLOOR).
 */
export function pickCommittingTeam(rng: Rng, interests: InterestRow[]): string | null {
  const valid = interests
    .filter((r) => r.interest >= INTEREST_FLOOR)
    .slice()
    .sort((a, b) => b.interest - a.interest || a.teamId.localeCompare(b.teamId));
  if (valid.length === 0) return null;
  const topN = valid.slice(0, 3);
  // Sprint 13: use interest^5 for sharp top-team wins. PRD exit test 2
  // requires top-5 programs to land elite-heavy classes (≥3.5 stars).
  // Lower exponents produced flat spreads across the top-3 teams.
  let total = 0;
  for (const r of topN) total += r.interest ** 5;
  if (total <= 0) return null;
  const pick = rng.next() * total;
  let acc = 0;
  for (const r of topN) {
    acc += r.interest ** 5;
    if (pick < acc) return r.teamId;
  }
  return topN[topN.length - 1]!.teamId;
}
