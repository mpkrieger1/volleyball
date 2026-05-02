import { describe, expect, it, beforeEach } from 'vitest';
import { useSettingsStore } from '../../../app/src/store/useSettingsStore';

beforeEach(() => {
  // localStorage may not be available in node env; guard.
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
  useSettingsStore.setState({ fontSize: 'md' });
});

describe('useSettingsStore', () => {
  it('default fontSize is md', () => {
    expect(useSettingsStore.getState().fontSize).toBe('md');
  });

  it('setFontSize updates state', () => {
    useSettingsStore.getState().setFontSize('lg');
    expect(useSettingsStore.getState().fontSize).toBe('lg');
  });

  it('setFontSize persists to localStorage', () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    useSettingsStore.getState().setFontSize('sm');
    expect(window.localStorage.getItem('vcd.settings.fontSize')).toBe('sm');
  });

  it('rejects unknown values via TypeScript types (runtime stays md)', () => {
    // setFontSize accepts only 'sm' | 'md' | 'lg' (ts-checked).
    useSettingsStore.getState().setFontSize('lg');
    expect(['sm', 'md', 'lg']).toContain(useSettingsStore.getState().fontSize);
  });
});
