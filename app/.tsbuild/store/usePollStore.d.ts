import type { pollIpc } from '@vcd/shared';
type Row = pollIpc.PollRowView;
type PollState = {
    week: number;
    rows: Row[];
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    load: (slotId: string) => Promise<void>;
};
export declare const usePollStore: import("zustand").UseBoundStore<import("zustand").StoreApi<PollState>>;
export {};
//# sourceMappingURL=usePollStore.d.ts.map