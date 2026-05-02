import { sim } from '@vcd/shared';
export type TeamMatchState = {
    lineup: sim.PlayerLineup;
    rotation: sim.RotationState;
    libero: sim.LiberoState | null;
    setterIndex: number;
    /** Offensive system config (Sprint 5). Defaults to a plain 5-1 when omitted. */
    system?: sim.SystemConfig;
};
export type TimeoutInvocation = {
    atRallyIdx: number;
    by: sim.TeamSide;
    opponentRunLength: number;
    momentumBefore: sim.MomentumState;
    momentumAfter: sim.MomentumState;
};
export type SetResult = {
    homeScore: number;
    awayScore: number;
    rallies: sim.RallyResult[];
    /** Momentum snapshot AFTER each rally's point is applied. */
    momentumAfterRally: sim.MomentumState[];
    finalHome: TeamMatchState;
    finalAway: TeamMatchState;
    servingTeamEnd: sim.TeamSide;
    finalMomentum: sim.MomentumState;
    finalTimeoutsHome: sim.TimeoutLedger;
    finalTimeoutsAway: sim.TimeoutLedger;
    timeouts: TimeoutInvocation[];
};
export type SimulateSetInput = {
    seed: number | string;
    home: TeamMatchState;
    away: TeamMatchState;
    initialServer: sim.TeamSide;
    targetScore?: number;
    useCoachAi?: boolean;
    initialMomentum?: sim.MomentumState;
};
export declare function simulateSet(input: SimulateSetInput): SetResult;
//# sourceMappingURL=set.d.ts.map