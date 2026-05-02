// Sprint 11: NCAA bracket round pairings.
//
// Standard 16-seed regional bracket, first-round ordering so that rank-1
// and rank-2 seeds can only meet in the regional final:
//   R64 slots per region (0..7):
//     0: 1 vs 16
//     1: 8 vs 9     ← pairs with slot 0 into R32 slot 0
//     2: 5 vs 12
//     3: 4 vs 13    ← pairs with slot 2 into R32 slot 1
//     4: 6 vs 11
//     5: 3 vs 14    ← pairs with slot 4 into R32 slot 2
//     6: 7 vs 10
//     7: 2 vs 15    ← pairs with slot 6 into R32 slot 3
// Within each region, slots 2i and 2i+1 pair into next-round slot i.
//
// Final Four: region champions from REGION_1..REGION_4 pair:
//   FF slot 0: REGION_1 E8 winner vs REGION_2 E8 winner
//   FF slot 1: REGION_3 E8 winner vs REGION_4 E8 winner
// Championship: FF[0] winner vs FF[1] winner.

import { REGIONS, type BracketRegion } from '../bracket/types';

export type R64Pairing = {
  region: BracketRegion;
  bracketSlot: number; // 0..7 within the region
  higherSeed: number;
  lowerSeed: number;
};

const R64_SEED_PAIRS: Array<[number, number]> = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

/**
 * Compute all 32 NCAA R64 pairings across the 4 regions given a map of
 * (region, seed) → teamId drawn from Sprint 10's BracketEntry rows.
 */
export function buildNcaaR64Pairings(
  seedByRegion: Map<BracketRegion, Map<number, string>>,
): Array<R64Pairing & { higherSeedTeamId: string; lowerSeedTeamId: string }> {
  const out: Array<R64Pairing & { higherSeedTeamId: string; lowerSeedTeamId: string }> = [];
  for (const region of REGIONS) {
    const seeds = seedByRegion.get(region);
    if (!seeds) continue;
    R64_SEED_PAIRS.forEach(([hi, lo], slot) => {
      const hiTeam = seeds.get(hi);
      const loTeam = seeds.get(lo);
      if (!hiTeam || !loTeam) return;
      out.push({
        region,
        bracketSlot: slot,
        higherSeed: hi,
        lowerSeed: lo,
        higherSeedTeamId: hiTeam,
        lowerSeedTeamId: loTeam,
      });
    });
  }
  return out;
}

/**
 * Region pairing for the Final Four. FF slot 0 = REGION_1 vs REGION_2,
 * FF slot 1 = REGION_3 vs REGION_4.
 */
export const FF_REGION_PAIRS: Array<[BracketRegion, BracketRegion]> = [
  ['REGION_1', 'REGION_2'],
  ['REGION_3', 'REGION_4'],
];
