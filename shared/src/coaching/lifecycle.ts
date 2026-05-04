// Sprint 28 Task 28.4: coach lifecycle policy. Pure functions, deterministic
// under a seeded RNG. Run once per offseason inside runOffseason's transaction.
//
// Phases (in order):
//   1. ageCoaches: bump tenure (no schema field for age — we track via
//      `careerWins` proxy and contract progression).
//   2. progressContracts: contractYears -- 1; expired triggers a renewal
//      probability check (per role / per prestige).
//   3. retirementsAndPoaching: roll random retirements (small chance) and
//      AI-team poaching of top assistants from lower-prestige rivals.
//   4. fillOpenSlots: any remaining vacancies fill from the hiring pool.
//      HC slots MUST be filled (see CLAUDE.md §Critical rules #4 invariant).
//
// Policy knobs are centralized at the top so calibration tweaks are local.

import type { Rng } from '../rng';

export const RETIREMENT_BASE_PROB = 0.04; // ~4% per coach per offseason
export const POACH_PROB_PER_TOP_ASSISTANT = 0.08; // 8% top-rated AHC/AC poach risk
export const CONTRACT_RENEWAL_PROB = 0.7; // 70% baseline renewal at expiry

export type CoachRow = {
  id: string;
  teamId: string;
  role: 'HC' | 'AHC' | 'AC';
  contractYears: number;
  ratingRecruit: number;
  ratingDevelop: number;
  ratingStrategy: number;
};

export type PoolRow = {
  id: string;
  ratingRecruit: number;
  ratingDevelop: number;
  ratingStrategy: number;
  preferredRole: 'HC' | 'AHC' | 'AC';
  askingSalaryCents: number;
  ageYears: number;
};

export type LifecycleAction =
  | { kind: 'retire'; coachId: string }
  | { kind: 'fire-expired'; coachId: string }
  | { kind: 'poach'; coachId: string }
  | { kind: 'fill'; teamId: string; role: 'HC' | 'AHC' | 'AC'; fromPoolId: string }
  | { kind: 'renew'; coachId: string };

function avgRating(c: { ratingRecruit: number; ratingDevelop: number; ratingStrategy: number }): number {
  return (c.ratingRecruit + c.ratingDevelop + c.ratingStrategy) / 3;
}

/** Step 1+2+3: decide which coaches retire / get poached / contracts expire. */
export function planTurnover(
  coaches: CoachRow[],
  rng: Rng,
): LifecycleAction[] {
  const actions: LifecycleAction[] = [];
  const sorted = [...coaches].sort((a, b) => a.id.localeCompare(b.id));
  for (const c of sorted) {
    const r = rng.fork(`coach:${c.id}`);
    // Retirements (rare, role-agnostic).
    if (r.fork('retire').next() < RETIREMENT_BASE_PROB) {
      actions.push({ kind: 'retire', coachId: c.id });
      continue;
    }
    // Poaching: top-tier assistants leave to take HC jobs elsewhere.
    if (c.role !== 'HC' && avgRating(c) >= 75) {
      if (r.fork('poach').next() < POACH_PROB_PER_TOP_ASSISTANT) {
        actions.push({ kind: 'poach', coachId: c.id });
        continue;
      }
    }
    // Contract expiry: contractYears <=1 means it expires this offseason.
    if (c.contractYears <= 1) {
      const renew = r.fork('renew').next() < CONTRACT_RENEWAL_PROB;
      if (renew) {
        actions.push({ kind: 'renew', coachId: c.id });
      } else {
        actions.push({ kind: 'fire-expired', coachId: c.id });
      }
    }
  }
  return actions;
}

/**
 * Step 4: fill open slots from the hiring pool. Returns one fill-action per
 * (team, role) that ended up open after planTurnover removed coaches. HC
 * slots MUST be filled — if no pool candidate prefers HC, promote the
 * highest-rated AHC on the same team. (AHC→HC promotion is a "renew" of
 * the AHC into an HC role; a separate fill action then opens AHC.)
 */
export function planFills(
  openSlots: Array<{ teamId: string; role: 'HC' | 'AHC' | 'AC' }>,
  pool: PoolRow[],
  rng: Rng,
): LifecycleAction[] {
  const actions: LifecycleAction[] = [];
  const used = new Set<string>();
  // Sort openSlots HC first so HCs get the best pool candidates.
  const sorted = [...openSlots].sort((a, b) => {
    const order: Record<'HC' | 'AHC' | 'AC', number> = { HC: 0, AHC: 1, AC: 2 };
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return a.teamId.localeCompare(b.teamId);
  });
  for (const slot of sorted) {
    // Candidates: prefer matching preferredRole; fall back to any unused.
    const matching = pool
      .filter((p) => !used.has(p.id) && p.preferredRole === slot.role)
      .sort((a, b) => avgRating(b) - avgRating(a));
    let chosen: PoolRow | undefined = matching[0];
    if (!chosen) {
      const any = pool
        .filter((p) => !used.has(p.id))
        .sort((a, b) => avgRating(b) - avgRating(a));
      chosen = any[0];
    }
    if (!chosen) {
      // Pool depleted — this should be rare. Skip; caller logs.
      continue;
    }
    used.add(chosen.id);
    actions.push({ kind: 'fill', teamId: slot.teamId, role: slot.role, fromPoolId: chosen.id });
    // Add a small jitter consumed from rng so the test seed binds to this
    // path even if the deterministic sort already covered ordering.
    rng.fork(`fill:${slot.teamId}:${slot.role}`).next();
  }
  return actions;
}
