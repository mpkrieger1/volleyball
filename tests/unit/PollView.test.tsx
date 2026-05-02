import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PollView } from '../../app/src/screens/PollView';
import { usePollStore } from '../../app/src/store/usePollStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

const makeRow = (rank: number, delta = '—') => ({
  rank,
  teamId: `t${rank}`,
  teamSchool: `Team ${rank}`,
  teamAbbr: `T${rank}`,
  record: '10-2',
  firstPlaceVotes: rank === 1 ? 50 : 0,
  prevRank: rank === 1 ? 2 : rank,
  delta,
});

const makeVcd = (over: Partial<Window['vcd']['poll']> = {}) => {
  const defaults: Window['vcd']['poll'] = {
    latest: vi.fn().mockResolvedValue({
      ok: true,
      week: 5,
      rows: Array.from({ length: 25 }, (_, i) => makeRow(i + 1, i < 5 ? '↑1' : '—')),
    }),
  };
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {} as Window['vcd']['match'],
    schedule: {} as Window['vcd']['schedule'],
    season: {} as Window['vcd']['season'],
    poll: { ...defaults, ...over },
  };
};

beforeEach(() => {
  usePollStore.setState({ week: 0, rows: [], status: 'idle', error: null });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
});

describe('<PollView />', () => {
  it('renders a 25-row table with week indicator', async () => {
    makeVcd();
    render(<PollView />);
    await waitFor(() => expect(screen.getByText(/Week 5/)).toBeInTheDocument());
    // Header + 25 data rows.
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(26);
  });

  it('empty state when no poll yet', async () => {
    makeVcd({
      latest: vi.fn().mockResolvedValue({ ok: true, week: 0, rows: [] }),
    });
    render(<PollView />);
    await waitFor(() => expect(screen.getByText(/No poll yet/i)).toBeInTheDocument());
  });

  it('error path shows alert', async () => {
    makeVcd({
      latest: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'slot gone' },
      }),
    });
    render(<PollView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('slot gone'));
  });

  it('axe-clean', async () => {
    makeVcd();
    const { container } = render(<PollView />);
    await waitFor(() => expect(screen.getByText(/Week 5/)).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
