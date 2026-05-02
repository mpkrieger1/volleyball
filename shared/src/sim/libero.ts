// Libero rules — Sprint 4 simplification:
//   - The libero enters for a back-row player on serve-receive and is paired
//     with that player until the next rotation boundary.
//   - The libero cannot attack when occupying a front-row position (approximates
//     FIVB rule 19.3.1.3 — "no attack above net height" — via slot position, not
//     net height).
//   - The libero cannot serve unless the one-rotation exception flag is set.

import { z } from 'zod';
import { isFrontRow, playerAt, positionOf, type Position, type RotationState } from './rotation';

export const LiberoStateSchema = z.object({
  /** Lineup index of the libero player (0..5 into the roster). */
  liberoIndex: z.number().int().min(0).max(5),
  /** Lineup index of the back-row player currently replaced, or null when the libero is off-court. */
  pairedBackRowIndex: z.number().int().min(0).max(5).nullable(),
  /** FIVB rule 19.3.2.1 single-rotation serve exception — may be set by coach AI. */
  exceptionUsed: z.boolean(),
});
export type LiberoState = z.infer<typeof LiberoStateSchema>;

export class LiberoRuleError extends Error {
  constructor(
    public readonly code: 'FRONT_ROW_SWAP' | 'ALREADY_PAIRED' | 'NOT_ON_COURT',
    message: string,
  ) {
    super(message);
    this.name = 'LiberoRuleError';
  }
}

export function liberoOff(liberoIndex: number): LiberoState {
  return { liberoIndex, pairedBackRowIndex: null, exceptionUsed: false };
}

/** Swap the libero in for a back-row player on this team. Throws if the target is not back-row. */
export function liberoReplace(
  state: LiberoState,
  rotation: RotationState,
  backRowPlayerIndex: number,
): LiberoState {
  const pos = positionOf(rotation, backRowPlayerIndex);
  if (pos === null) {
    throw new LiberoRuleError('NOT_ON_COURT', `Player ${backRowPlayerIndex} is not in rotation.`);
  }
  if (isFrontRow(pos)) {
    throw new LiberoRuleError(
      'FRONT_ROW_SWAP',
      `Libero may only replace a back-row player (attempted ${pos}).`,
    );
  }
  if (state.pairedBackRowIndex !== null && state.pairedBackRowIndex !== backRowPlayerIndex) {
    throw new LiberoRuleError(
      'ALREADY_PAIRED',
      `Libero is already paired with ${state.pairedBackRowIndex}; cannot swap to ${backRowPlayerIndex} without returning first.`,
    );
  }
  return { ...state, pairedBackRowIndex: backRowPlayerIndex };
}

/** Libero leaves the court (e.g., rotation boundary or rally end). */
export function liberoReturn(state: LiberoState): LiberoState {
  return { ...state, pairedBackRowIndex: null };
}

/**
 * True when the given player CANNOT attack from their current position.
 * Applies only to the libero while they occupy a front-row slot — they are
 * never normally in front-row because they only replace back-row players, but
 * this guard defends against bugs in selection logic.
 */
export function liberoBlocksAttack(
  state: LiberoState,
  rotation: RotationState,
  attackerIndex: number,
): boolean {
  if (attackerIndex !== state.liberoIndex) return false;
  const pos = positionOf(rotation, attackerIndex);
  return pos !== null && isFrontRow(pos);
}

/**
 * True when the libero may legally serve this rally — false unless the
 * one-rotation exception has been explicitly invoked.
 */
export function canServe(state: LiberoState, serverIndex: number): boolean {
  if (serverIndex !== state.liberoIndex) return true;
  return state.exceptionUsed;
}

/** Returns the at-P1 player, substituting the paired starter when the libero would be the server. */
export function serverAtP1(state: LiberoState | null, rotation: RotationState): number {
  const p1 = playerAt(rotation, 'P1');
  if (state === null) return p1;
  if (p1 !== state.liberoIndex) return p1;
  if (state.exceptionUsed) return p1;
  // Libero would be serving — fall back to paired player if known, else the next back-row.
  return state.pairedBackRowIndex ?? playerAt(rotation, 'P5');
}

/** True iff the libero is currently replacing someone (on court). */
export function liberoIsOnCourt(state: LiberoState): boolean {
  return state.pairedBackRowIndex !== null;
}

export type { Position };
