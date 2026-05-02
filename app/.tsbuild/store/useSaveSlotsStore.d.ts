import type { saveSlotIpc } from '@vcd/shared';
type SaveSlotSummary = saveSlotIpc.SaveSlotSummary;
export type SaveSlotsState = {
    slots: SaveSlotSummary[];
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    openedSlotId: string | null;
    load: () => Promise<void>;
    /**
     * Sprint 21: returns the new slot id so the SaveSlots screen can hand it
     * to the user-team picker. Returns null on error.
     */
    create: (name: string) => Promise<string | null>;
    open: (id: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
};
export declare const useSaveSlotsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SaveSlotsState>>;
export {};
//# sourceMappingURL=useSaveSlotsStore.d.ts.map