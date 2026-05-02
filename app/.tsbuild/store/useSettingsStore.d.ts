export type FontSize = 'sm' | 'md' | 'lg';
export declare const FONT_SIZES: readonly FontSize[];
type SettingsState = {
    fontSize: FontSize;
    setFontSize: (s: FontSize) => void;
    diagnosticsEnabled: boolean;
    setDiagnosticsEnabled: (v: boolean) => void;
    hasCompletedFirstRun: boolean;
    setHasCompletedFirstRun: (v: boolean) => void;
};
export declare const useSettingsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SettingsState>>;
export {};
//# sourceMappingURL=useSettingsStore.d.ts.map