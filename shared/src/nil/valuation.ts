// Sprint 15: player NIL value engine.
//
// Value in cents based on overall rating, potential ceiling, position
// scarcity (MB/OPP rarer than OH), and class year (JR peaks, SR
// discounted because leaving soon).
//
// This is the "market rate" for a player's NIL deal. Auto-distribute
// uses these values as weights for proportional allocation.

import type { Position } from '../recruiting/types';

export type ValuationPlayer = {
  overall: number; // 0..100
  potential: number; // 0..100
  position: Position;
  classYear: 'FR' | 'SO' | 'JR' | 'SR' | 'GR';
};

export const BASE_CENTS = 500_00; // $500 floor
export const OVERALL_DOLLARS_PER_POINT = 1_000; // $1k per rating point above 50
export const POTENTIAL_DOLLARS_PER_POINT = 300; // $300 per potential point above 60

export const POSITION_MULTIPLIER: Record<Position, number> = {
  MB: 1.15,
  OPP: 1.10,
  S: 1.05,
  OH: 1.00,
  L: 0.90,
  DS: 0.85,
};

export const CLASS_YEAR_MULTIPLIER: Record<'FR' | 'SO' | 'JR' | 'SR' | 'GR', number> = {
  FR: 1.00,
  SO: 1.05,
  JR: 1.20,
  SR: 0.70,
  GR: 0.60,
};

export function computePlayerValue(player: ValuationPlayer): number {
  const overallDollars = Math.max(0, player.overall - 50) * OVERALL_DOLLARS_PER_POINT;
  const potentialDollars = Math.max(0, player.potential - 60) * POTENTIAL_DOLLARS_PER_POINT;
  const rawDollars = (overallDollars + potentialDollars)
    * POSITION_MULTIPLIER[player.position]
    * CLASS_YEAR_MULTIPLIER[player.classYear];
  const cents = Math.max(BASE_CENTS, Math.round(rawDollars * 100));
  return cents;
}
