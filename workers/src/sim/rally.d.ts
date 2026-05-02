import { sim, type Rng } from '@vcd/shared';
type PlayerLineup = sim.PlayerLineup;
type RallyResult = sim.RallyResult;
type TeamSide = sim.TeamSide;
type RotationState = sim.RotationState;
type LiberoState = sim.LiberoState;
type SystemConfig = sim.SystemConfig;
type MomentumState = sim.MomentumState;
export type SimulateRallyInput = {
    seed: number | string;
    home: PlayerLineup;
    away: PlayerLineup;
    servingTeam: TeamSide;
    /**
     * Optional rotation state per team. When present for either team, selection
     * for that team is position-aware. When omitted, Sprint 3 flat round-robin
     * behavior applies for back-compat.
     */
    homeRotation?: RotationState;
    awayRotation?: RotationState;
    /** Optional libero state per team. Ignored if the team has no rotation state. */
    homeLibero?: LiberoState | null;
    awayLibero?: LiberoState | null;
    /**
     * Lineup index of the designated setter for each team. Sprint 4 uses a single
     * setter regardless of position (5-1 baseline); Sprint 5's system toggle will
     * replace this with rotation-derived selection.
     */
    homeSetterIndex?: number;
    awaySetterIndex?: number;
    /**
     * Offensive system per team (Sprint 5). When omitted, falls back to the
     * setterIndex/round-robin path. When provided, drives setter + attacker
     * selection via `deriveCurrentSetter` and `eligibleFrontRowAttackers`.
     */
    homeSystem?: SystemConfig;
    awaySystem?: SystemConfig;
    /** Momentum state at start of rally (Sprint 5). Biases attack kill rate. */
    momentum?: MomentumState;
};
export declare function simulateRally(input: SimulateRallyInput): RallyResult;
/** Export primarily for tests. */
export declare function pureRng(seed: number | string): Rng;
export {};
//# sourceMappingURL=rally.d.ts.map