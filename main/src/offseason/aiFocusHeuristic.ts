// Sprint 33 Task 33.4 — AI focus heuristic.
//
// For an AI team's coach (role HC/AHC/AC), pick the top-3 attributes by
// average per-roster headroom (`maxScale * attrCurve`). Each role has
// exactly 3 trainable attributes (Sprint 32), so this returns all 3 in
// rank order — but the rank order is what matters: applied to slots 0/1/2
// in priority sequence so the highest-headroom attribute gets slot 0
// (no repeated-focus penalty).
//
// Determinism: pure function of (role, roster snapshot, facilitiesLevel).
// Tie-break: alphabetical by attribute name.

import { offseason } from '@vcd/shared';

type CoachRole = 'HC' | 'AHC' | 'AC';

type RosterPlayer = {
  potential: number;
  ratingAttack: number;
  ratingBlock: number;
  ratingServe: number;
  ratingPass: number;
  ratingSet: number;
  ratingDig: number;
  ratingAthleticism: number;
  ratingIq: number;
  ratingStamina: number;
};

const RATING_FIELD: Record<offseason.TrainableSkill, keyof RosterPlayer> = {
  attack: 'ratingAttack',
  block: 'ratingBlock',
  serve: 'ratingServe',
  pass: 'ratingPass',
  set: 'ratingSet',
  dig: 'ratingDig',
  athleticism: 'ratingAthleticism',
  iq: 'ratingIq',
  stamina: 'ratingStamina',
};

export type PickAiFocusesArgs = {
  role: CoachRole;
  roster: RosterPlayer[];
  facilitiesLevel: number;
};

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

const CURVE = offseason.lineFunc(40, 1.5, 100, 0.25);

function meanHeadroomFor(
  attribute: offseason.TrainableSkill,
  roster: RosterPlayer[],
): number {
  if (roster.length === 0) return 0;
  let sum = 0;
  const field = RATING_FIELD[attribute];
  for (const p of roster) {
    const maxScale = Math.floor(p.potential / 10) - 1;
    const attrCurve = clamp(CURVE(p[field] as number), 0, 2);
    sum += maxScale * attrCurve;
  }
  return sum / roster.length;
}

export function pickAiFocusesForCoach(
  args: PickAiFocusesArgs,
): offseason.TrainableSkill[] {
  const candidates = offseason.getValidTrainingFocuses(args.role);
  const scored = candidates.map((attr) => ({
    attr,
    score: meanHeadroomFor(attr, args.roster),
  }));
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score; // desc
    return a.attr.localeCompare(b.attr);              // alphabetical tiebreak
  });
  return scored.map((s) => s.attr);
}
