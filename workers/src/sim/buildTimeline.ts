// Sprint 19: aggregate per-set timeouts (and future substitutions) from a
// MatchResult into the cross-process MatchTimeline shape.

import { sim } from '@vcd/shared';
import type { MatchResult } from './match';

export function buildMatchTimeline(match: MatchResult): sim.MatchTimeline {
  const timeouts: sim.TimeoutEvent[] = [];
  for (let setIdx = 0; setIdx < match.sets.length; setIdx++) {
    const s = match.sets[setIdx]!;
    // Score at timeout = score at the moment the timeout was called, BEFORE
    // the rally at atRallyIdx is played.
    for (const t of s.timeouts) {
      let scoreHome = 0;
      let scoreAway = 0;
      for (let r = 0; r < t.atRallyIdx && r < s.rallies.length; r++) {
        const rr = s.rallies[r]!;
        if (rr.winningTeam === 'home') scoreHome++;
        else scoreAway++;
      }
      timeouts.push({
        setIndex: setIdx,
        atRallyIdx: t.atRallyIdx,
        by: t.by,
        scoreHome,
        scoreAway,
        opponentRunLength: t.opponentRunLength,
      });
    }
  }
  // Substitutions stay empty for Sprint 19 — libero/starter swaps are not
  // tracked in production sim today (see CLAUDE.md "From Sprint 19").
  return { timeouts, substitutions: [] };
}
