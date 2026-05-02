import type { nilIpc } from '@vcd/shared';
export type NilRow = nilIpc.NilRosterRowView;
type NilState = {
    collectiveBudget: number;
    totalSpent: number;
    remaining: number;
    enthusiasm: number;
    roster: NilRow[];
    status: 'idle' | 'loading' | 'working' | 'ready' | 'error';
    error: string | null;
    load: (slotId: string, teamId: string) => Promise<void>;
    assign: (slotId: string, teamId: string, playerId: string, amountCents: number) => Promise<void>;
    revoke: (slotId: string, teamId: string, playerId: string) => Promise<void>;
    autoDistribute: (slotId: string, teamId: string) => Promise<void>;
};
export declare const useNilStore: import("zustand").UseBoundStore<import("zustand").StoreApi<NilState>>;
export {};
//# sourceMappingURL=useNilStore.d.ts.map