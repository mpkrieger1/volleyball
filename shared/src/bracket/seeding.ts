// Region seeding via strict S-curve.
//
// Given 64 teams ranked 1..64 by metric, fill 4 regions × 16 seeds so that:
//   - Seed 1 in each region is an overall top-4 team.
//   - Line N (seeds 4N-3 .. 4N) is distributed across regions using an
//     S-curve: line 1 goes R1,R2,R3,R4; line 2 reverses R4,R3,R2,R1; and
//     alternating thereafter.
//
// The S-curve guarantees no team is seeded more than 0 lines off its metric
// rank. Future sprints can introduce region-host preferences with a
// max-swap-distance guardrail to respect the ±2-line PRD bound.

import { REGIONS, type BracketEntryRow, type BracketRegion } from './types';
import type { SelectedTeam } from './selection';

export const SEEDS_PER_REGION = 16;
export const REGION_COUNT = REGIONS.length;

export function seedBracket(selected: SelectedTeam[]): BracketEntryRow[] {
  const field = SEEDS_PER_REGION * REGION_COUNT;
  if (selected.length !== field) {
    throw new Error(`seedBracket expected ${field} teams, received ${selected.length}`);
  }
  // Selected is already sorted by metricRank asc; assign overall ranks 1..64.
  const out: BracketEntryRow[] = [];
  for (let line = 1; line <= SEEDS_PER_REGION; line++) {
    const leftToRight = line % 2 === 1; // odd lines forward; even lines reverse
    for (let slot = 0; slot < REGION_COUNT; slot++) {
      const overallIndex = (line - 1) * REGION_COUNT + slot; // 0..63
      const regionIndex = leftToRight ? slot : REGION_COUNT - 1 - slot;
      const region = REGIONS[regionIndex] as BracketRegion;
      const team = selected[overallIndex];
      if (!team) continue;
      out.push({
        teamId: team.teamId,
        region,
        seed: line,
        autoBid: team.autoBid,
        metricRank: team.metricRank,
      });
    }
  }
  return out;
}
