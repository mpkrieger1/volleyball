// Offensive systems:
//   5-1 — single designated setter; when back-row, they set and may dump;
//         when front-row, they set AND are in the attacker pool.
//   6-2 — two setters (opposite each other); the BACK-ROW setter runs the set,
//         the front-row "opposite" attacks. Setter is NEVER in the attacker pool.

import { z } from 'zod';
import { isFrontRow, playerAt, positionOf, type RotationState } from './rotation';
import type { LiberoState } from './libero';
import { liberoBlocksAttack } from './libero';

export const SystemSchema = z.enum(['5-1', '6-2']);
export type System = z.infer<typeof SystemSchema>;

export const SystemConfigSchema = z.discriminatedUnion('system', [
  z.object({ system: z.literal('5-1'), setterIndex: z.number().int().min(0).max(5) }),
  z.object({
    system: z.literal('6-2'),
    setterAIndex: z.number().int().min(0).max(5),
    setterBIndex: z.number().int().min(0).max(5),
  }),
]);
export type SystemConfig = z.infer<typeof SystemConfigSchema>;

/**
 * Lineup index of the player running the set this rally.
 * 5-1: always the designated setter.
 * 6-2: whichever of the two setters is currently in the back row. If both are
 * front-row (shouldn't happen in a legal opposite pairing), falls back to A.
 */
export function deriveCurrentSetter(
  config: SystemConfig,
  rotation: RotationState,
): number {
  if (config.system === '5-1') return config.setterIndex;
  const posA = positionOf(rotation, config.setterAIndex);
  const posB = positionOf(rotation, config.setterBIndex);
  if (posA && !isFrontRow(posA)) return config.setterAIndex;
  if (posB && !isFrontRow(posB)) return config.setterBIndex;
  return config.setterAIndex;
}

/**
 * Lineup indices legal to attack from front-row given the current system.
 * - 5-1: all 3 front-row slots (setter-in-front is a legitimate attacker).
 * - 6-2: front-row slots except BOTH setter indices. Since the two setters
 *   sit opposite each other, one is always in front-row — excluding both
 *   gives 6-2 a 2-hitter front-row pool in every rotation. This is the trade
 *   against 5-1's 3-hitter pool and is what makes the two systems measurably
 *   different in sim output.
 * In either case, the libero is excluded defensively.
 */
export function eligibleFrontRowAttackers(
  config: SystemConfig,
  rotation: RotationState,
  libero: LiberoState | null = null,
): number[] {
  const frontRow = [playerAt(rotation, 'P2'), playerAt(rotation, 'P3'), playerAt(rotation, 'P4')];
  let list = frontRow;
  if (config.system === '6-2') {
    list = list.filter((idx) => idx !== config.setterAIndex && idx !== config.setterBIndex);
  }
  if (libero) list = list.filter((idx) => !liberoBlocksAttack(libero, rotation, idx));
  return list;
}

/** Convenience: build a default 5-1 config where lineup index 0 is the setter. */
export function defaultSystem51(): SystemConfig {
  return { system: '5-1', setterIndex: 0 };
}

/** Convenience: default 6-2 with setters at lineup indices 0 and 3 (opposite). */
export function defaultSystem62(): SystemConfig {
  return { system: '6-2', setterAIndex: 0, setterBIndex: 3 };
}
