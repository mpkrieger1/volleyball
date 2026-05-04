import { create } from 'zustand';
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
  /**
   * Sprint 28: close the currently-opened slot and return to the save-slots
   * screen. SQLite persists every write inline, so "saving" is implicit;
   * this just clears `openedSlotId`. Callers should reset downstream stores
   * (user-team, season, etc.) to avoid stale data leaking into the next
   * opened slot.
   */
  close: () => void;
  remove: (id: string) => Promise<void>;
};

export const useSaveSlotsStore = create<SaveSlotsState>((set, get) => ({
  slots: [],
  status: 'idle',
  error: null,
  openedSlotId: null,

  async load() {
    set({ status: 'loading', error: null });
    const res = await window.vcd.saveSlots.list();
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    set({ slots: res.slots, status: 'ready' });
  },

  async create(name) {
    const res = await window.vcd.saveSlots.create(name);
    if (!res.ok) {
      set({ error: res.error.message });
      return null;
    }
    set({ error: null });
    await get().load();
    return res.slot.id;
  },

  async open(id) {
    const res = await window.vcd.saveSlots.open(id);
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({ openedSlotId: res.slot.id, error: null });
  },

  close() {
    set({ openedSlotId: null, error: null });
  },

  async remove(id) {
    const res = await window.vcd.saveSlots.delete(id);
    if (!res.ok) {
      set({ error: res.error.message });
      return;
    }
    set({ error: null });
    await get().load();
  },
}));
