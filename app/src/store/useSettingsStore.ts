// Sprint 21: per-device user preferences. Currently font size + Sprint 23
// crash-reporting opt-in.

import { create } from 'zustand';

export type FontSize = 'sm' | 'md' | 'lg';
export const FONT_SIZES: readonly FontSize[] = ['sm', 'md', 'lg'] as const;

const FONT_SIZE_KEY = 'vcd.settings.fontSize';
const CRASH_REPORTING_KEY = 'vcd.settings.crashReportingEnabled';

function loadFontSize(): FontSize {
  if (typeof window === 'undefined' || !window.localStorage) return 'md';
  try {
    const v = window.localStorage.getItem(FONT_SIZE_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore localStorage errors */
  }
  return 'md';
}

function loadCrashReporting(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(CRASH_REPORTING_KEY) === '1';
  } catch {
    return false;
  }
}

type SettingsState = {
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  crashReportingEnabled: boolean;
  setCrashReportingEnabled: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  fontSize: loadFontSize(),
  setFontSize(s) {
    set({ fontSize: s });
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(FONT_SIZE_KEY, s);
      } catch {
        /* ignore */
      }
    }
  },
  crashReportingEnabled: loadCrashReporting(),
  setCrashReportingEnabled(v) {
    set({ crashReportingEnabled: v });
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CRASH_REPORTING_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  },
}));
