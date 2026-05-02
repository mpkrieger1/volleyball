import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { SeasonPanel } from '../../app/src/screens/SeasonPanel';
import { useSeasonStore } from '../../app/src/store/useSeasonStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

const makeVcd = (over: Partial<Window['vcd']['season']> = {}) => {
  let progressListener: ((e: unknown) => void) | null = null;
  const defaults: Window['vcd']['season'] = {
    getCurrentWeek: vi.fn().mockResolvedValue({ ok: true, currentWeek: 0, phase: 'PRESEASON' }),
    advanceWeek: vi.fn().mockResolvedValue({ ok: true, week: 0, matchesPlayed: 10, elapsedMs: 500 }),
    cancel: vi.fn().mockResolvedValue({ ok: true, cancelled: true }),
    onProgress: (listener) => {
      progressListener = listener as (e: unknown) => void;
      return () => {
        progressListener = null;
      };
    },
  };
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {} as Window['vcd']['match'],
    schedule: {} as Window['vcd']['schedule'],
    season: { ...defaults, ...over },
  };
  return { ...(window as unknown as { vcd: Window['vcd'] }).vcd.season, emit: (e: unknown) => progressListener?.(e) };
};

beforeEach(() => {
  useSeasonStore.setState({
    currentWeek: 0,
    phase: 'PRESEASON',
    status: 'idle',
    error: null,
    progress: null,
    cancellationId: null,
    lastAdvanceElapsedMs: null,
  });
  useSaveSlotsStore.setState({
    slots: [], status: 'idle', error: null, openedSlotId: 'slot-1',
  });
});

describe('<SeasonPanel />', () => {
  it('loads current week on mount and renders heading', async () => {
    makeVcd();
    render(<SeasonPanel />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/pre-season/i));
  });

  it('Advance click triggers IPC and updates week', async () => {
    const mocks = makeVcd();
    const user = userEvent.setup();
    render(<SeasonPanel />);
    await screen.findByRole('heading', { level: 2 });
    await user.click(screen.getByRole('button', { name: /advance week 0/i }));
    await waitFor(() => expect(mocks.advanceWeek).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/week 1/i),
    );
  });

  it('Cancel button appears during advancing state', async () => {
    // Use a never-resolving getCurrentWeek so loadCurrentWeek doesn't flip
    // status back to 'idle' during this test.
    makeVcd({ getCurrentWeek: vi.fn().mockImplementation(() => new Promise(() => {})) });
    render(<SeasonPanel />);
    // After initial render, push state into advancing.
    useSeasonStore.setState({
      status: 'advancing',
      progress: { totalMatches: 100, completedMatches: 42, phase: 'sim' },
      cancellationId: 'id-1',
    });
    const cancel = await screen.findByRole('button', { name: /cancel/i });
    expect(cancel).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    makeVcd();
    const { container } = render(<SeasonPanel />);
    await screen.findByRole('heading', { level: 2 });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
