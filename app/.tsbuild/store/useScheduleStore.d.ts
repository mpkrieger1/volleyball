import type { matchIpc, scheduleIpc } from '@vcd/shared';
type TeamSummary = matchIpc.TeamSummary;
type Row = scheduleIpc.TeamScheduleRow;
type ScheduleStats = {
    totalMatches: number;
    confMatches: number;
    nonConfMatches: number;
    tournamentMatches: number;
};
type ScheduleState = {
    teams: TeamSummary[];
    selectedTeamId: string | null;
    rows: Row[];
    status: 'idle' | 'loading' | 'ready' | 'generating' | 'error';
    error: string | null;
    stats: ScheduleStats | null;
    loadTeams: (slotId: string) => Promise<void>;
    selectTeam: (slotId: string, teamId: string) => Promise<void>;
    generate: (slotId: string, seed?: string) => Promise<void>;
};
export declare const useScheduleStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ScheduleState>>;
export {};
//# sourceMappingURL=useScheduleStore.d.ts.map