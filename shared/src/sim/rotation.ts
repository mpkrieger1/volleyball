// Volleyball rotation state. Positions are numbered P1..P6 per standard
// convention:
//
//     [P4  P3  P2]   ← net
//     [P5  P6  P1]
//
// P1 is the server position (back-right). On side-out, every player rotates one
// position clockwise: P2→P1, P3→P2, P4→P3, P5→P4, P6→P5, P1→P6.
//
// The `slots` array stores lineup-player indices (0..5 pointing into a
// PlayerLineup.players tuple) at each position in order [P1, P2, P3, P4, P5, P6].
// After six `rotate()` calls the state is identical to the starting state.

import { z } from 'zod';

const slotIndex = z.number().int().min(0).max(5);

export const RotationStateSchema = z.object({
  slots: z.tuple([slotIndex, slotIndex, slotIndex, slotIndex, slotIndex, slotIndex]),
});
export type RotationState = z.infer<typeof RotationStateSchema>;

export type Position = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
const POSITIONS: readonly Position[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

export const FRONT_ROW_POSITIONS: readonly Position[] = ['P2', 'P3', 'P4'];
export const BACK_ROW_POSITIONS: readonly Position[] = ['P1', 'P5', 'P6'];

export function isFrontRow(pos: Position): boolean {
  return pos === 'P2' || pos === 'P3' || pos === 'P4';
}
export function isBackRow(pos: Position): boolean {
  return pos === 'P1' || pos === 'P5' || pos === 'P6';
}

function posIndex(pos: Position): number {
  return POSITIONS.indexOf(pos);
}

/** Returns the lineup-player index currently at the given position. */
export function playerAt(state: RotationState, pos: Position): number {
  return state.slots[posIndex(pos)]!;
}

/** Position currently occupied by the given lineup index (or null if absent). */
export function positionOf(state: RotationState, lineupIndex: number): Position | null {
  const i = state.slots.indexOf(lineupIndex);
  return i === -1 ? null : POSITIONS[i]!;
}

/** One clockwise rotation: the P2 player becomes the new server at P1. */
export function rotate(state: RotationState): RotationState {
  const s = state.slots;
  return { slots: [s[1], s[2], s[3], s[4], s[5], s[0]] };
}

/** Apply N rotations deterministically. */
export function rotateBy(state: RotationState, n: number): RotationState {
  let out = state;
  const steps = ((n % 6) + 6) % 6;
  for (let i = 0; i < steps; i++) out = rotate(out);
  return out;
}

/** Default starting rotation for a freshly-introduced set: slots 0..5 at P1..P6. */
export function initialRotation(): RotationState {
  return { slots: [0, 1, 2, 3, 4, 5] };
}

export type OverlapCheck =
  | { ok: true }
  | { ok: false; code: 'DUPLICATE_SLOT' | 'INVALID_PLAYER_INDEX' };

/**
 * Canonical-form overlap check. Catches data corruption (duplicate indices,
 * out-of-range values). Real volleyball overlap rules key off continuous
 * positioning at serve contact; that's a Sprint 5+ concern.
 */
export function checkOverlap(state: RotationState): OverlapCheck {
  const seen = new Set<number>();
  for (const idx of state.slots) {
    if (idx < 0 || idx > 5 || !Number.isInteger(idx)) {
      return { ok: false, code: 'INVALID_PLAYER_INDEX' };
    }
    if (seen.has(idx)) return { ok: false, code: 'DUPLICATE_SLOT' };
    seen.add(idx);
  }
  return { ok: true };
}
