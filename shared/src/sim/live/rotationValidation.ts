// Sprint 31 Task 31.1: rotation validator for the editor modal.
//
// Pure function — no DB, no IO. Validates that a user-proposed
// (slots, system, libero) configuration satisfies real volleyball rules:
//
//   1. All 6 slots filled with distinct player ids.
//   2. Setter overlap (FIVB 7.4 simplification): in 5-1, the OPP must be
//      OPPOSITE the setter (P1↔P4, P2↔P5, P3↔P6). In 6-2, the two setters
//      are opposite each other.
//   3. Libero is one of the 6 placed players AND is a back-row position
//      at the start of the set (P1, P5, or P6).
//
// The editor pre-validates so Save is disabled until ok=true. Service-side
// also runs this and returns CONFLICT on failure (defense in depth).

import type { System } from '../system';

export type Slot = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
const SLOTS: readonly Slot[] = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/** Standard opposite map for setter-OPP overlap rule (FIVB simplification). */
export const OPPOSITE_SLOT: Record<Slot, Slot> = {
  P1: 'P4',
  P2: 'P5',
  P3: 'P6',
  P4: 'P1',
  P5: 'P2',
  P6: 'P3',
};

const FRONT_ROW = new Set<Slot>(['P2', 'P3', 'P4']);
const BACK_ROW = new Set<Slot>(['P1', 'P5', 'P6']);

/**
 * Editor input shape — keyed by slot label (P1..P6) for renderer
 * convenience. The IPC schema mirrors this.
 */
export type RotationConfig = {
  /** Player id at each slot. Empty string = unfilled. */
  slots: Record<Slot, string>;
  system: System;
  /** Player id designated as libero. Must be one of the 6 slot occupants. */
  libero: string;
  /**
   * 5-1 only: the slot label that holds the designated setter.
   * Determines the opposite-OPP requirement.
   */
  setterSlot?: Slot;
  /**
   * 6-2 only: the two slot labels of the two setters (must be opposite).
   */
  setterSlotsTwo?: { a: Slot; b: Slot };
  /** 6-2 only: the player id of the OPP at the OTHER opposite (informational). */
  oppPlayerId?: string;
};

export type ValidateResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateRotation(cfg: RotationConfig): ValidateResult {
  const errors: string[] = [];

  // 1. All 6 slots filled.
  const ids = SLOTS.map((s) => cfg.slots[s] ?? '');
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] ?? '';
    if (id.trim() === '') {
      errors.push(`Slot ${SLOTS[i]} is empty.`);
    }
  }

  // 2. All 6 distinct.
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] ?? '';
    if (id.trim() !== '') {
      if (seen.has(id)) {
        errors.push(`Player ${id} placed in multiple slots.`);
      }
      seen.add(id);
    }
  }

  // 3. Setter overlap (5-1).
  if (cfg.system === '5-1') {
    if (!cfg.setterSlot) {
      errors.push('5-1 system requires a designated setter slot.');
    } else {
      const opp = OPPOSITE_SLOT[cfg.setterSlot];
      // We only enforce that the OPP slot is filled (setter ↔ OPP opposite).
      // Without explicit position labels per slot, we can't enforce that the
      // OPP is actually a position-OPP player — that's a v1.x check.
      if (!cfg.slots[opp] || cfg.slots[opp].trim() === '') {
        errors.push(`5-1: opposite slot (${opp}) of setter (${cfg.setterSlot}) is empty.`);
      }
    }
  }

  // 4. Setter overlap (6-2): two setters must be at opposite slots.
  if (cfg.system === '6-2') {
    if (!cfg.setterSlotsTwo) {
      errors.push('6-2 system requires two setter slots.');
    } else {
      const { a, b } = cfg.setterSlotsTwo;
      if (a === b) {
        errors.push('6-2: the two setters must be at different slots.');
      } else if (OPPOSITE_SLOT[a] !== b) {
        errors.push(`6-2: setters at ${a} and ${b} are not opposite (expected ${OPPOSITE_SLOT[a]}).`);
      }
    }
  }

  // 5. Libero must be one of the 6 placed players.
  if (!cfg.libero || cfg.libero.trim() === '') {
    errors.push('Libero must be designated.');
  } else {
    const liberoSlot = SLOTS.find((s) => cfg.slots[s] === cfg.libero);
    if (!liberoSlot) {
      errors.push(`Libero ${cfg.libero} is not assigned to any slot.`);
    } else if (FRONT_ROW.has(liberoSlot)) {
      errors.push(`Libero must be at a back-row slot (P1, P5, or P6); placed at ${liberoSlot}.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

export { FRONT_ROW, BACK_ROW, SLOTS };
