// Sprint 32 Tasks 32.3 + 32.4 — port of FCCD's training gain range +
// breakthrough chance. Pure deterministic helpers; no IO, no RNG.
//
// Design: FCCD uses a single `potential` (0..100) plus a per-attribute
// "line function" multiplier so that low-rated attributes gain a lot and
// high-rated attributes barely move — producing an organic per-skill soft
// cap WITHOUT explicit per-skill potential columns. See
// docs/sprints/sprint-32-spec.md §1.

import { getRepeatedFocusMultiplier } from './repeatedFocusMultiplier';

function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

/**
 * Linear interpolation: returns f such that f(x1) = y1 and f(x2) = y2.
 * Extrapolates outside [x1, x2]. Direct port of FCCD's `lineFunc`.
 */
export function lineFunc(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const slope = (y2 - y1) / (x2 - x1);
  return (x) => y1 + slope * (x - x1);
}

/**
 * FCCD facilities-tier baseline gain.
 *   1–2 → 0,  3–5 → 1,  6–7 → 2,  8–9 → 3,  10 → 4.
 * Calibration risk: numbers ship as the FCCD ballpark; revisit in
 * Sprint 33 against a 5-season Vitest run.
 */
export function getFacilitiesBaseGain(level: number): number {
  if (level >= 10) return 4;
  if (level >= 8) return 3;
  if (level >= 6) return 2;
  if (level >= 3) return 1;
  return 0;
}

export interface TrainingGainArgs {
  /** Player.potential, 0..100. */
  potential: number;
  /** Current rating in the focused attribute, 0..100. */
  currentRating: number;
  /** Team.facilitiesLevel, 1..10. */
  facilitiesLevel: number;
  /**
   * `true` when a coach has explicitly picked this attribute as their focus
   * for the offseason event; `false` for background drift gains from a
   * coach skill perk.
   */
  isFocused: boolean;
}

export interface TrainingGainRange {
  min: number;
  max: number;
}

/**
 * Direct port of FCCD module 97136. Returns the integer [min, max] gain
 * range to roll within for the focused attribute.
 *
 * Floor:    `1` when focused, else `getFacilitiesBaseGain(facilitiesLevel)`.
 * Ceiling:  `maxScale * attrCurve` (clamped to be at least the floor).
 *           - `maxScale = floor(potential/10) - 1`
 *             (potential 60 → 5, 90 → 8, 100 → 9).
 *           - `attrCurve = clamp(lineFunc(40,1.5,100,0.25)(currentRating), 0, 2)`
 *             (1.5× at rating 40, 0.25× at rating 100).
 */
export function getTrainingGainAmountRange(args: TrainingGainArgs): TrainingGainRange {
  const facilitiesBase = getFacilitiesBaseGain(args.facilitiesLevel);
  const maxScale = Math.floor(args.potential / 10) - 1;
  const min = args.isFocused ? 1 : facilitiesBase;
  const attrCurve = clamp(lineFunc(40, 1.5, 100, 0.25)(args.currentRating), 0, 2);
  const max = Math.max(maxScale * attrCurve, min);
  return { min: Math.round(min), max: Math.round(max) };
}

export interface BreakthroughArgs {
  /** Player.potential, 0..100. */
  potential: number;
  /** Coach skill bonus, 0..50 (Sprint 33 supplies). */
  coachBreakthroughBonus: number;
  /** See `getRepeatedFocusMultiplier`. */
  repeatedFocusCount: number;
}

/**
 * Port of FCCD module 39825. Probability that the focus pick triggers a
 * "breakthrough" (an extra small bonus gain on top of the regular range).
 * Sprint 32 ships the chance helper; Sprint 33 wires it into the actual roll.
 *
 * The result is mathematically bounded in [0, 1] for valid inputs
 * (potential ≤ 100, bonus ≤ 50, repeatedFocusCount ≥ 0); we clamp
 * defensively in case Sprint 33 callers pass bonus > 50.
 */
export function getTrainingBreakthroughChance(args: BreakthroughArgs): number {
  const base = (args.potential / 2 + args.coachBreakthroughBonus) / 100;
  const raw = getRepeatedFocusMultiplier(args.repeatedFocusCount) * base;
  return clamp(raw, 0, 1);
}
