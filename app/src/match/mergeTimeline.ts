// Sprint 19: merge PBP rallies + timeline (timeouts/subs) into a flat
// sequence of TickerEntry items for the live ticker scheduler.
//
// Pacing model: every entry consumes one scheduler tick. Rally events are
// emitted in order; a timeout banner appears immediately BEFORE the rally
// at its `atRallyIdx` (right when a real coach would call it).

import type { sim } from '@vcd/shared';

export type TickerEntry =
  | {
      kind: 'event';
      setIndex: number;
      rallyIndex: number;
      event: sim.RallyEvent;
    }
  | {
      kind: 'timeout';
      setIndex: number;
      atRallyIdx: number;
      by: 'home' | 'away';
      scoreHome: number;
      scoreAway: number;
    }
  | {
      kind: 'substitution';
      setIndex: number;
      atRallyIdx: number;
      team: 'home' | 'away';
      subKind: 'libero_in' | 'libero_out' | 'sub_in' | 'sub_out';
      slotIndex: number;
    }
  | {
      kind: 'set_break';
      setIndex: number;
      finalHome: number;
      finalAway: number;
    };

export function mergeTimeline(
  pbp: sim.MatchPbp,
  timeline: sim.MatchTimeline,
): TickerEntry[] {
  const out: TickerEntry[] = [];
  for (const set of pbp.sets) {
    // Banners scoped to this set, indexed by atRallyIdx for fast lookup.
    const timeoutsByRally = new Map<number, sim.TimeoutEvent[]>();
    for (const t of timeline.timeouts) {
      if (t.setIndex !== set.setIndex) continue;
      const list = timeoutsByRally.get(t.atRallyIdx) ?? [];
      list.push(t);
      timeoutsByRally.set(t.atRallyIdx, list);
    }
    const subsByRally = new Map<number, sim.SubstitutionEvent[]>();
    for (const s of timeline.substitutions) {
      if (s.setIndex !== set.setIndex) continue;
      const list = subsByRally.get(s.atRallyIdx) ?? [];
      list.push(s);
      subsByRally.set(s.atRallyIdx, list);
    }

    for (let r = 0; r < set.rallies.length; r++) {
      // Banners fire BEFORE the rally at this index.
      for (const t of timeoutsByRally.get(r) ?? []) {
        out.push({
          kind: 'timeout',
          setIndex: set.setIndex,
          atRallyIdx: t.atRallyIdx,
          by: t.by,
          scoreHome: t.scoreHome,
          scoreAway: t.scoreAway,
        });
      }
      for (const s of subsByRally.get(r) ?? []) {
        out.push({
          kind: 'substitution',
          setIndex: set.setIndex,
          atRallyIdx: s.atRallyIdx,
          team: s.team,
          subKind: s.kind,
          slotIndex: s.slotIndex,
        });
      }
      const rally = set.rallies[r]!;
      for (const event of rally.events) {
        out.push({
          kind: 'event',
          setIndex: set.setIndex,
          rallyIndex: rally.rallyIndex,
          event,
        });
      }
    }
    out.push({
      kind: 'set_break',
      setIndex: set.setIndex,
      finalHome: set.homeScore,
      finalAway: set.awayScore,
    });
  }
  return out;
}
