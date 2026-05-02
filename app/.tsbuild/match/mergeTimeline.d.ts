import type { sim } from '@vcd/shared';
export type TickerEntry = {
    kind: 'event';
    setIndex: number;
    rallyIndex: number;
    event: sim.RallyEvent;
} | {
    kind: 'timeout';
    setIndex: number;
    atRallyIdx: number;
    by: 'home' | 'away';
    scoreHome: number;
    scoreAway: number;
} | {
    kind: 'substitution';
    setIndex: number;
    atRallyIdx: number;
    team: 'home' | 'away';
    subKind: 'libero_in' | 'libero_out' | 'sub_in' | 'sub_out';
    slotIndex: number;
} | {
    kind: 'set_break';
    setIndex: number;
    finalHome: number;
    finalAway: number;
};
export declare function mergeTimeline(pbp: sim.MatchPbp, timeline: sim.MatchTimeline): TickerEntry[];
//# sourceMappingURL=mergeTimeline.d.ts.map