import type { awardsIpc } from '@vcd/shared';
export type AwardEntry = awardsIpc.AwardEntry;
export type CareerEntry = awardsIpc.CareerEntry;
export type AaTeam = awardsIpc.AaTeam;
type AwardsState = {
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    seasonYear: number | null;
    availableSeasons: number[];
    teams: Record<AaTeam, AwardEntry[]>;
    careerByPlayerId: Record<string, CareerEntry[]>;
    loadForSeason: (slotId: string, seasonYear: number) => Promise<void>;
    loadCareer: (slotId: string, playerId: string) => Promise<void>;
    reset: () => void;
};
export declare const useAwardsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AwardsState>>;
export {};
//# sourceMappingURL=useAwardsStore.d.ts.map