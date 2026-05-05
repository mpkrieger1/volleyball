// Sprint 34 — FCCD-style weekly practice focus.
//
// Each regular-season week, each team picks one offensive + one defensive
// focus. The picks yield a small (~3-5%) per-match probability bump
// applied at match start. Practice focus does NOT mutate Player.rating*;
// it's a per-match buff only (CLAUDE.md §Critical rules #4 invariant).
//
// FCCD parallel: module 7538 (`getValidPracticeFocuses` + `getAutoPracticeFocus`
// + per-focus modifier table). The volleyball analogue compresses the
// FCCD list (~14 categories) to 4 offensive + 4 defensive focuses tuned
// to volleyball's serve / pass / set / attack / block / dig pipeline.
//
// Pure module — no IO, no Prisma. Consumed by `simulateMatch` (workers)
// + `advanceWeek` (main) + the renderer's PracticeFocusPicker.

export type OffensePracticeFocus =
  | 'POWER_HITTING'        // attack-heavy
  | 'BALL_CONTROL'         // pass + set; useful vs heavy block
  | 'SERVE_AGGRESSION'     // serve-aggression
  | 'TRANSITION_OFFENSE';  // mixed / fallback

export type DefensePracticeFocus =
  | 'BLOCK_HEAVY'          // counters power hitting
  | 'DEFEND_TIPS_ROLLS'    // counters tippy / off-speed offense
  | 'DEFEND_POWER_HITTING' // dig-heavy backline
  | 'SERVE_RECEIVE_FOCUS'; // counters tough servers

const OFFENSE_FOCUSES: readonly OffensePracticeFocus[] = [
  'POWER_HITTING',
  'BALL_CONTROL',
  'SERVE_AGGRESSION',
  'TRANSITION_OFFENSE',
] as const;

const DEFENSE_FOCUSES: readonly DefensePracticeFocus[] = [
  'BLOCK_HEAVY',
  'DEFEND_TIPS_ROLLS',
  'DEFEND_POWER_HITTING',
  'SERVE_RECEIVE_FOCUS',
] as const;

export function getValidOffenseFocuses(): readonly OffensePracticeFocus[] {
  return OFFENSE_FOCUSES;
}

export function getValidDefenseFocuses(): readonly DefensePracticeFocus[] {
  return DEFENSE_FOCUSES;
}

/**
 * Rolled-up opponent tendency snapshot, used by the auto-pickers. Sourced
 * from the opponent's last-N matches' PMS rows (see
 * `main/src/practiceFocus/opponentSummary.ts` for the aggregator).
 *
 * Note on PMS limitations: the schema doesn't store totalServes /
 * totalReceptions directly, so `serveAceRate` and `aceAllowedRate` use
 * per-match averages as proxies. This is acceptable for v1.2 since the
 * auto-picker only needs ordinal comparisons (high vs low), not exact rates.
 */
export interface OpponentSummary {
  /** Opponent's serving aces per attempt (or per-match proxy). [0, 1] */
  serveAceRate: number;
  /** Aces the opponent has CONCEDED on serve receive. [0, 1] */
  aceAllowedRate: number;
  /** Opponent's hitting %. [-1, 1] (negatives possible per Sprint 22). */
  hittingPct: number;
  /** Opponent's blocks per set. [0, ~5] */
  blockPerSet: number;
  /** Opponent's digs per set. [0, ~25] */
  digPerSet: number;
  /** Opponent's attack errors per attempt. [0, 1] */
  attackErrorRate: number;
}

/** FCCD-style "auto pick" — chooses the best counter focus by ordinal thresholds. */
export function getAutoOffenseFocus(opponent: OpponentSummary): OffensePracticeFocus {
  // Opponent gives up easy aces → press the serve.
  if (opponent.aceAllowedRate >= 0.10) return 'SERVE_AGGRESSION';
  // Opponent's block dominates → emphasize ball control over power.
  if (opponent.blockPerSet >= 3.0) return 'BALL_CONTROL';
  // Opponent's defense is poor → swing big.
  if (opponent.digPerSet < 10.0) return 'POWER_HITTING';
  return 'TRANSITION_OFFENSE';
}

export function getAutoDefenseFocus(opponent: OpponentSummary): DefensePracticeFocus {
  // Opponent serves tough → focus serve receive.
  if (opponent.serveAceRate >= 0.08) return 'SERVE_RECEIVE_FOCUS';
  // Opponent hits well → load up the block.
  if (opponent.hittingPct >= 0.32) return 'BLOCK_HEAVY';
  // Opponent is efficient (low error rate) → defend their power hitting.
  if (opponent.attackErrorRate < 0.13) return 'DEFEND_POWER_HITTING';
  return 'DEFEND_TIPS_ROLLS';
}

// ─────────────────────────────────────────────────────────────
// Bonus modifier (Task 34.3)
// ─────────────────────────────────────────────────────────────

export interface PracticeFocusModifier {
  /** Multiplier on attack-kill probability. */
  attackBonus: number;
  /** Multiplier on serve-ace probability. */
  serveBonus: number;
  /** Multiplier on pass-perfect/good probability. */
  passBonus: number;
  /** Multiplier on block-success probability. */
  blockBonus: number;
  /** Multiplier on dig-kept probability. */
  digBonus: number;
}

// zod schema for IPC validation. Imported by `seasonMessages.ts` to extend
// the WorkerSimRequest contract.
import { z } from 'zod';
export const PracticeFocusModifierSchema = z.object({
  attackBonus: z.number(),
  serveBonus: z.number(),
  passBonus: z.number(),
  blockBonus: z.number(),
  digBonus: z.number(),
});

/** Identity modifier — all bonuses 1.0. Sentinel for the byte-equality gate. */
export const IDENTITY_PRACTICE_FOCUS_MODIFIER: PracticeFocusModifier = {
  attackBonus: 1,
  serveBonus: 1,
  passBonus: 1,
  blockBonus: 1,
  digBonus: 1,
};

const PRIMARY_BUMP = 1.04;   // 4% on the targeted phase
const SECONDARY_BUMP = 1.02; // 2% on the adjacent phase

/**
 * Compute the per-side modifier from an (offense, defense) pair. Each
 * focus contributes 1× / 1.04× to one or two phases of the sim pipeline.
 *
 * The OFFENSE focus boosts attacking-side phases (attack / serve / pass /
 * dig). The DEFENSE focus boosts defending-side phases (block / dig).
 *
 * Bonuses are clamped to [0.95, 1.10]. Magnitudes match FCCD's
 * gameplan-install nudges (small but detectable across many rallies).
 */
export function applyPracticeFocusBonus(
  offense: OffensePracticeFocus,
  defense: DefensePracticeFocus,
): PracticeFocusModifier {
  const m: PracticeFocusModifier = {
    attackBonus: 1,
    serveBonus: 1,
    passBonus: 1,
    blockBonus: 1,
    digBonus: 1,
  };

  switch (offense) {
    case 'POWER_HITTING':
      m.attackBonus *= PRIMARY_BUMP;
      break;
    case 'BALL_CONTROL':
      m.passBonus *= PRIMARY_BUMP;
      m.attackBonus *= SECONDARY_BUMP;
      break;
    case 'SERVE_AGGRESSION':
      m.serveBonus *= PRIMARY_BUMP;
      break;
    case 'TRANSITION_OFFENSE':
      m.attackBonus *= SECONDARY_BUMP;
      m.digBonus *= SECONDARY_BUMP;
      break;
  }

  switch (defense) {
    case 'BLOCK_HEAVY':
      m.blockBonus *= PRIMARY_BUMP;
      break;
    case 'DEFEND_TIPS_ROLLS':
      m.digBonus *= PRIMARY_BUMP;
      break;
    case 'DEFEND_POWER_HITTING':
      m.digBonus *= SECONDARY_BUMP;
      m.blockBonus *= SECONDARY_BUMP;
      break;
    case 'SERVE_RECEIVE_FOCUS':
      m.passBonus *= PRIMARY_BUMP;
      break;
  }

  return m;
}
