// Sprint 21: per-device user preferences (font size).
// Sprint 23: crash-reporting opt-in.
// Sprint 24: rename `crashReportingEnabled` → `diagnosticsEnabled` for the
//   user-facing label. Existing localStorage entries migrate on first read.
// Sprint 24: first-run flag + `setHasCompletedFirstRun`.
// Sprint 26 (Task 26.4): playbook-modal flag + `setHasSeenPlaybook` for the
//   season-rhythm explainer that mounts after FirstRunModal.

import { create } from 'zustand';

export type FontSize = 'sm' | 'md' | 'lg';
export const FONT_SIZES: readonly FontSize[] = ['sm', 'md', 'lg'] as const;

const FONT_SIZE_KEY = 'vcd.settings.fontSize';
const DIAGNOSTICS_KEY = 'vcd.settings.diagnosticsEnabled';
const LEGACY_CRASH_REPORTING_KEY = 'vcd.settings.crashReportingEnabled';
const FIRST_RUN_KEY = 'vcd.settings.hasCompletedFirstRun';
const PLAYBOOK_KEY = 'vcd.settings.hasSeenPlaybook';

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

/**
 * Sprint 24 migration: read the new key first; if absent and the legacy
 * Sprint 23 key is present, copy the value forward and delete the legacy
 * key. Idempotent — once migrated, the legacy key is gone forever.
 */
function loadDiagnostics(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const current = window.localStorage.getItem(DIAGNOSTICS_KEY);
    if (current !== null) return current === '1';
    const legacy = window.localStorage.getItem(LEGACY_CRASH_REPORTING_KEY);
    if (legacy !== null) {
      const value = legacy === '1';
      window.localStorage.setItem(DIAGNOSTICS_KEY, value ? '1' : '0');
      window.localStorage.removeItem(LEGACY_CRASH_REPORTING_KEY);
      return value;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function loadHasCompletedFirstRun(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(FIRST_RUN_KEY) === '1';
  } catch {
    return false;
  }
}

function loadHasSeenPlaybook(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(PLAYBOOK_KEY) === '1';
  } catch {
    return false;
  }
}

type SettingsState = {
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  diagnosticsEnabled: boolean;
  setDiagnosticsEnabled: (v: boolean) => void;
  hasCompletedFirstRun: boolean;
  setHasCompletedFirstRun: (v: boolean) => void;
  hasSeenPlaybook: boolean;
  setHasSeenPlaybook: (v: boolean) => void;
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
  diagnosticsEnabled: loadDiagnostics(),
  setDiagnosticsEnabled(v) {
    set({ diagnosticsEnabled: v });
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DIAGNOSTICS_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  },
  hasCompletedFirstRun: loadHasCompletedFirstRun(),
  setHasCompletedFirstRun(v) {
    set({ hasCompletedFirstRun: v });
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(FIRST_RUN_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  },
  hasSeenPlaybook: loadHasSeenPlaybook(),
  setHasSeenPlaybook(v) {
    set({ hasSeenPlaybook: v });
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(PLAYBOOK_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  },
}));
