export type FontSize = 'sm' | 'md' | 'lg';
export declare const FONT_SIZES: readonly FontSize[];
type SettingsState = {
    fontSize: FontSize;
    setFontSize: (s: FontSize) => void;
    crashReportingEnabled: boolean;
    setCrashReportingEnabled: (v: boolean) => void;
};
export declare const useSettingsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SettingsState>>;
export {};
//# sourceMappingURL=useSettingsStore.d.ts.map