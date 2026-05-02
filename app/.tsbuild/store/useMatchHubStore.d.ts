import type { matchIpc, scoutIpc } from '@vcd/shared';
import { type ReplaySpeed } from '../match/replayScheduler';
import { type TickerEntry } from '../match/mergeTimeline';
type TeamSummary = matchIpc.TeamSummary;
type MatchPayload = Extract<matchIpc.GetMatchByIdResponse, {
    ok: true;
}>;
type ScoutPayload = Extract<scoutIpc.ScoutReportResponse, {
    ok: true;
}>;
export type MatchHubPhase = 'select' | 'loading-teams' | 'loading-scout' | 'ready-to-play' | 'simulating' | 'loading-replay' | 'replay-ready' | 'playing' | 'paused' | 'done' | 'error';
export type MatchHubState = {
    phase: MatchHubPhase;
    teams: TeamSummary[];
    selectedHomeId: string | null;
    selectedAwayId: string | null;
    scout: ScoutPayload | null;
    match: MatchPayload | null;
    ticker: TickerEntry[];
    /** Recent N events visible in the ticker scroll area (capped). */
    visibleTicker: TickerEntry[];
    currentEventIdx: number;
    speed: ReplaySpeed;
    scoreHome: number;
    scoreAway: number;
    setIndex: number;
    setHomeScores: number[];
    setAwayScores: number[];
    /** Active timeout/sub banner; null when none. */
    banner: {
        kind: 'timeout' | 'substitution';
        text: string;
    } | null;
    error: string | null;
    loadTeams: (slotId: string) => Promise<void>;
    setHome: (id: string) => void;
    setAway: (id: string) => void;
    loadScout: (slotId: string, opponentTeamId: string) => Promise<void>;
    simulateAndLoad: (slotId: string, seed?: string) => Promise<void>;
    play: () => void;
    pause: () => void;
    setSpeed: (s: ReplaySpeed) => void;
    finishInstantly: () => void;
    reset: () => void;
};
export declare const useMatchHubStore: import("zustand").UseBoundStore<import("zustand").StoreApi<MatchHubState>>;
export {};
//# sourceMappingURL=useMatchHubStore.d.ts.map