// Sprint 4 best-of-5 match loop. Sprint 19: optional `useCoachAi` enables
// timeout invocations during sets — production matches now opt in so the
// Match Hub ticker has real timeout events to surface.

import { sim } from '@vcd/shared';
import { simulateSet, type SetResult, type TeamMatchState } from './set';

export type MatchResult = {
  winner: sim.TeamSide;
  homeSetsWon: number;
  awaySetsWon: number;
  sets: SetResult[];
};

export type SimulateMatchInput = {
  seed: number | string;
  home: TeamMatchState;
  away: TeamMatchState;
  /** Server for set 1. Set N's server is whichever team is NOT set N-1's initial server. */
  initialServer: sim.TeamSide;
  /**
   * Sprint 19: when true, coach AI may call timeouts between rallies. Default
   * is `false` to preserve the deterministic behavior of older tests; the
   * worker thread / production code path passes `true` so the live ticker
   * has timeout banners to render.
   */
  useCoachAi?: boolean;
};

export function simulateMatch(input: SimulateMatchInput): MatchResult {
  let home = { ...input.home, rotation: input.home.rotation };
  let away = { ...input.away, rotation: input.away.rotation };
  let initialServer = input.initialServer;
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  const sets: SetResult[] = [];
  const useCoachAi = input.useCoachAi ?? false;

  for (let setIdx = 0; setIdx < 5; setIdx++) {
    const isDecider = setIdx === 4;
    const target = isDecider ? 15 : 25;
    const result = simulateSet({
      seed: `${input.seed}:s${setIdx}`,
      home,
      away,
      initialServer,
      targetScore: target,
      useCoachAi,
    });
    sets.push(result);
    if (result.homeScore > result.awayScore) homeSetsWon += 1;
    else awaySetsWon += 1;

    if (homeSetsWon >= 3 || awaySetsWon >= 3) break;

    // Carry rotation state forward into the next set (real rule is: fresh
    // starting lineup per set; Sprint 4 simplifies by carrying current state).
    // Sprint 5 will reset to the coach-set starting lineup.
    home = result.finalHome;
    away = result.finalAway;
    initialServer = initialServer === 'home' ? 'away' : 'home';
  }

  return {
    winner: homeSetsWon > awaySetsWon ? 'home' : 'away',
    homeSetsWon,
    awaySetsWon,
    sets,
  };
}
