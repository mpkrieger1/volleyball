import { create } from 'zustand';
import type { coachingIpc } from '@vcd/shared';

export type StaffRow = coachingIpc.StaffRow;
export type PoolRow = coachingIpc.PoolRow;

type CoachingState = {
  staff: StaffRow[];
  pool: PoolRow[];
  budgetCents: number;
  status: 'idle' | 'loading' | 'working' | 'ready' | 'error';
  error: string | null;
  load: (slotId: string, teamId: string) => Promise<void>;
  fire: (slotId: string, teamId: string, coachId: string) => Promise<void>;
  hire: (req: {
    slotId: string;
    teamId: string;
    poolId: string;
    role: 'HC' | 'AHC' | 'AC';
    contractYears: number;
    salaryCents: number;
  }) => Promise<void>;
};

export const useCoachingStore = create<CoachingState>((set, get) => ({
  staff: [],
  pool: [],
  budgetCents: 0,
  status: 'idle',
  error: null,
  async load(slotId, teamId) {
    set({ status: 'loading', error: null });
    const [staffRes, poolRes] = await Promise.all([
      window.vcd.coaching.listStaff(slotId, teamId),
      window.vcd.coaching.listPool(slotId),
    ]);
    if (!staffRes.ok) {
      set({ status: 'error', error: staffRes.error.message });
      return;
    }
    if (!poolRes.ok) {
      set({ status: 'error', error: poolRes.error.message });
      return;
    }
    set({
      staff: staffRes.staff,
      pool: poolRes.pool,
      budgetCents: staffRes.operatingBudgetCents,
      status: 'ready',
    });
  },
  async fire(slotId, teamId, coachId) {
    set({ status: 'working', error: null });
    const res = await window.vcd.coaching.fire({ slotId, teamId, coachId });
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(slotId, teamId);
  },
  async hire(req) {
    set({ status: 'working', error: null });
    const res = await window.vcd.coaching.hire(req);
    if (!res.ok) {
      set({ status: 'error', error: res.error.message });
      return;
    }
    await get().load(req.slotId, req.teamId);
  },
}));
