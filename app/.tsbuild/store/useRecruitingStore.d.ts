import type { recruitingIpc } from '@vcd/shared';
export type BoardRecruit = recruitingIpc.BoardRecruitView;
type Filter = {
    position?: string;
    region?: string;
    minStars?: number;
};
type RecruitingState = {
    phase: string;
    week: number;
    budgetRemaining: number;
    recruits: BoardRecruit[];
    status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
    error: string | null;
    filter: Filter;
    load: (slotId: string, teamId: string) => Promise<void>;
    setFilter: (f: Filter) => void;
    openCycle: (slotId: string, seasonYear: number, classSize?: number) => Promise<void>;
    performAction: (slotId: string, teamId: string, recruitId: string, action: recruitingIpc.RecruitingActionType) => Promise<void>;
    advanceWeek: (slotId: string, userTeamId: string | null) => Promise<void>;
    closeCycle: (slotId: string) => Promise<void>;
};
export declare const useRecruitingStore: import("zustand").UseBoundStore<import("zustand").StoreApi<RecruitingState>>;
export {};
//# sourceMappingURL=useRecruitingStore.d.ts.map