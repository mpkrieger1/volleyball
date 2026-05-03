// Sprint 26 Task 26.4 tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PlaybookModal } from '../../app/src/components/PlaybookModal';
import { useSettingsStore } from '../../app/src/store/useSettingsStore';

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState({
    fontSize: 'md',
    diagnosticsEnabled: false,
    hasCompletedFirstRun: true,
    hasSeenPlaybook: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlaybookModal', () => {
  it('renders the season-rhythm header and all 5 phases', () => {
    render(<PlaybookModal onClose={() => undefined} />);
    expect(screen.getByText(/The Season Rhythm/i)).toBeInTheDocument();
    // Phase names render in the phase-list as exact strings — not via the
    // ambient prose. Match the bolded `<strong>` per phase rather than the
    // free-text body so we don't collide with ambient mentions of "NCAA".
    const list = screen.getByRole('list', { name: /season phases/i });
    expect(list).toHaveTextContent('PRESEASON');
    expect(list).toHaveTextContent('REGULAR');
    expect(list).toHaveTextContent('CONF_TOURNEY');
    expect(list).toHaveTextContent('NCAA');
    expect(list).toHaveTextContent('OFFSEASON');
  });

  it('"Got it" button dismisses + persists hasSeenPlaybook=true', () => {
    const onClose = vi.fn();
    render(<PlaybookModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('playbook-dismiss'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().hasSeenPlaybook).toBe(true);
    expect(window.localStorage.getItem('vcd.settings.hasSeenPlaybook')).toBe('1');
  });

  it('Escape key dismisses', () => {
    const onClose = vi.fn();
    render(<PlaybookModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().hasSeenPlaybook).toBe(true);
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(<PlaybookModal onClose={() => undefined} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('dialog has correct ARIA shape', () => {
    render(<PlaybookModal onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'playbook-title');
  });
});

describe('useSettingsStore.hasSeenPlaybook', () => {
  it('defaults to false on a clean localStorage', () => {
    window.localStorage.clear();
    // Re-trigger the load by setting the state to its loaded value.
    expect(useSettingsStore.getState().hasSeenPlaybook).toBe(false);
  });

  it('setHasSeenPlaybook(true) persists to localStorage', () => {
    useSettingsStore.getState().setHasSeenPlaybook(true);
    expect(window.localStorage.getItem('vcd.settings.hasSeenPlaybook')).toBe('1');
    expect(useSettingsStore.getState().hasSeenPlaybook).toBe(true);
  });

  it('setHasSeenPlaybook(false) clears the flag', () => {
    useSettingsStore.getState().setHasSeenPlaybook(true);
    useSettingsStore.getState().setHasSeenPlaybook(false);
    expect(window.localStorage.getItem('vcd.settings.hasSeenPlaybook')).toBe('0');
    expect(useSettingsStore.getState().hasSeenPlaybook).toBe(false);
  });
});
