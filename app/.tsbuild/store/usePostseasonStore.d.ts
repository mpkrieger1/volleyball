import type { postseasonIpc } from '@vcd/shared';
export type TourneyMatch = postseasonIpc.TourneyMatchView;
/** Which view the BracketView screen is showing. Sprint 11. */
export type View = 'conf' | 'ncaa' | 'champion';
export type Region = 'REGION_1' | 'REGION_2' | 'REGION_3' | 'REGION_4' | 'FINAL_FOUR';
type PostseasonState = {
    phase: string;
    seasonYear: number;
    championTeamId: string | null;
    championTeamSchool: string | null;
    matches: TourneyMatch[];
    status: 'idle' | 'loading' | 'advancing' | 'ready' | 'error';
    error: string | null;
    /** Which view is visible — persists across nav switches (exit test 3). */
    view: View;
    /** Selected region tab on the NCAA screen — persists across nav switches. */
    selectedRegion: Region;
    /** Selected conference id on the CT screen (null = show all). */
    selectedConferenceId: string | null;
    load: (slotId: string) => Promise<void>;
    setView: (v: View) => void;
    setRegion: (r: Region) => void;
    setConferenceId: (id: string | null) => void;
    startCt: (slotId: string) => Promise<void>;
    startNcaa: (slotId: string, seasonYear: number) => Promise<void>;
    advanceRound: (slotId: string, round: postseasonIpc.TournamentRound) => Promise<void>;
};
export declare const usePostseasonStore: import("zustand").UseBoundStore<import("zustand").StoreApi<PostseasonState>>;
export {};
//# sourceMappingURL=usePostseasonStore.d.ts.map