// Sprint 31 Task 31.3: real volleyball positional rules.
//
// Locked behavior (live mode only — gated by useLivePositionalRules):
//   - Front-row attackers: attack rating × 1.10 (uniform across hints).
//   - Back-row passers (P1, P5, P6): pass rating × by-hint multiplier.
//   - 5-1 setter dump: when setter is at front-row + system is 5-1 +
//     hint is defensive, with low frequency (3-7%) the setter "dumps"
//     instead of setting up a hitter.
//
// Back-row attacks are NOT modeled in v1.1 (existing rally FSM treats
// any back-row attacker as a rotation_violation point loss). Documented
// in CLAUDE.md "From Sprint 31" as deferred to v1.2.
//
// All multipliers are applied per-PLAYER based on rotation, NOT per-team
// uniformly — front-row attackers see the bump, back-row don't. This is
// orthogonal to the Sprint 30 momentum/boost matrix (which IS per-team
// uniform). Both layers compose multiplicatively in the rally engine.

import type { PlayerLineup } from '../lineup';
import type { RotationState } from '../rotation';
import { isFrontRow, positionOf, FRONT_ROW_POSITIONS, BACK_ROW_POSITIONS } from '../rotation';
import type { LiberoState } from '../libero';
import type { TacticalHint } from './state';

void FRONT_ROW_POSITIONS; // exported for downstream reference
void BACK_ROW_POSITIONS;

/** Per-hint engine knobs. Locked from spec § 31.3 § "Per-hint summary table." */
export const HINT_TABLE: Record<TacticalHint, {
  frontRowAttackMult: number;
  backRowPassMult: number;
  setterDumpProb: number; // 5-1 + front-row setter only
}> = {
  aggressive: { frontRowAttackMult: 1.10, backRowPassMult: 1.05, setterDumpProb: 0.07 },
  balanced:   { frontRowAttackMult: 1.10, backRowPassMult: 1.10, setterDumpProb: 0.05 },
  defensive:  { frontRowAttackMult: 1.10, backRowPassMult: 1.15, setterDumpProb: 0.03 },
};

/**
 * Apply positional multipliers to a team's lineup based on the rotation +
 * libero state + tactical hint. Returns a NEW PlayerLineup with the
 * adjusted ratings (or the original by reference if no adjustments would
 * be applied — preserves byte-equality with simulateMatch).
 *
 * Per-position effects:
 *   - Front-row attackers (P2/P3/P4): attack rating × hint.frontRowAttackMult
 *   - Back-row passers (P1/P5/P6): pass rating × hint.backRowPassMult
 *
 * The libero, when on court, replaces a back-row player and inherits the
 * back-row pass boost (a key reason real liberos exist).
 */
export function applyPositionalToLineup(
  lineup: PlayerLineup,
  rotation: RotationState,
  libero: LiberoState | null,
  hint: TacticalHint,
): PlayerLineup {
  const knobs = HINT_TABLE[hint];
  if (knobs.frontRowAttackMult === 1.0 && knobs.backRowPassMult === 1.0) {
    return lineup;
  }

  const cap = (v: number): number => Math.min(100, v);

  const players = lineup.players.map((p, slotIdx) => {
    const pos = positionOf(rotation, slotIdx);
    if (pos === null) return p;
    const isFront = isFrontRow(pos);
    // Libero on court inherits back-row passing bonus too (treated as a back-row
    // player even though they're a special role).
    const isBackRowPasser = !isFront;
    const newAttack = isFront ? cap(p.attack * knobs.frontRowAttackMult) : p.attack;
    const newPass = isBackRowPasser ? cap(p.pass * knobs.backRowPassMult) : p.pass;
    if (newAttack === p.attack && newPass === p.pass) return p;
    return { ...p, attack: newAttack, pass: newPass };
  });

  void libero; // libero replacement is handled in the rally FSM via
  // serverAtP1 + receiver selection; the bench-row pass boost above
  // already covers the libero-on-court case (libero at slot 5 is back-row).

  return { ...lineup, players };
}

/**
 * Setter-dump probability for a team. Returns 0 unless ALL of:
 *   - useLivePositionalRules is on (caller checks)
 *   - system is 5-1 (6-2 setter never attacks; they're locked back-row when setting)
 *   - setter is currently at a front-row position
 *
 * Honors the full HINT_TABLE rates per spec § 31.3 table:
 *   aggressive → 0.07, balanced → 0.05, defensive → 0.03
 * (Earlier reading gated to defensive-only; corrected per retro to honor
 *  the table across all hints. Aggressive plays MORE setter dumps because
 *  the offense is taking more risks, not fewer.)
 */
export function setterDumpProbability(
  hint: TacticalHint,
  system: '5-1' | '6-2',
  setterAtFrontRow: boolean,
): number {
  if (system !== '5-1') return 0;
  if (!setterAtFrontRow) return 0;
  return HINT_TABLE[hint].setterDumpProb;
}

/**
 * True iff the team's current setter is at a front-row position. Used by
 * the rally FSM (Task 31.3 step.ts wiring) to decide whether to evaluate
 * setterDumpProbability.
 */
export function isSetterFrontRow(
  system: { system: '5-1'; setterIndex: number } | { system: '6-2'; setterAIndex: number; setterBIndex: number } | undefined,
  rotation: RotationState,
): boolean {
  if (!system) return false;
  if (system.system === '5-1') {
    const pos = positionOf(rotation, system.setterIndex);
    return pos !== null && isFrontRow(pos);
  }
  // 6-2: setter is whichever of A/B is back-row. If neither is back-row
  // (impossible in legal opposite pairing), default to A.
  const posA = positionOf(rotation, system.setterAIndex);
  if (posA && !isFrontRow(posA)) return false;
  const posB = positionOf(rotation, system.setterBIndex);
  if (posB && !isFrontRow(posB)) return false;
  // Both front-row (degenerate; Sprint 5 fallback returns A as setter).
  return posA !== null && isFrontRow(posA);
}
