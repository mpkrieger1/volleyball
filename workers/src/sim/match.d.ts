import { sim } from '@vcd/shared';
import { type SetResult, type TeamMatchState } from './set';
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
};
export declare function simulateMatch(input: SimulateMatchInput): MatchResult;
//# sourceMappingURL=match.d.ts.map