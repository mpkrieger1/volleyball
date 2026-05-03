import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ScheduleView } from '../../app/src/screens/ScheduleView';
import { useScheduleStore } from '../../app/src/store/useScheduleStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

const makeVcd = (over: Partial<Window['vcd']> = {}) => {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: vi.fn().mockResolvedValue({
        ok: true,
        teams: [
          { id: 't1', schoolName: 'Alpha', abbr: 'ALPH', conferenceId: 'c1', primaryColor: '#111', secondaryColor: '#222', prestige: 60 },
          { id: 't2', schoolName: 'Beta', abbr: 'BETA', conferenceId: 'c1', primaryColor: '#333', secondaryColor: '#444', prestige: 55 },
        ],
      }),
      simulate: vi.fn(),
    },
    schedule: {
      generate: vi.fn().mockResolvedValue({
        ok: true,
        stats: { totalMatches: 100, confMatches: 80, nonConfMatches: 20, tournamentMatches: 4 },
      }),
      listForTeam: vi.fn().mockResolvedValue({
        ok: true,
        rows: [
          { matchId: 'm1', weekIndex: 0, isoDate: '2026-08-28', opponentId: 't2', opponentSchool: 'Beta', opponentAbbr: 'BETA', isHome: true, isConference: false, isTournament: false, isNeutralSite: false, winnerId: null },
          { matchId: 'm2', weekIndex: 4, isoDate: '2026-09-25', opponentId: 't2', opponentSchool: 'Beta', opponentAbbr: 'BETA', isHome: false, isConference: true, isTournament: false, isNeutralSite: false, winnerId: null },
        ],
      }),
    },
    season: {
      getCurrentWeek: vi.fn().mockResolvedValue({ ok: true, currentWeek: 0, phase: 'PRESEASON' }),
      advanceWeek: vi.fn(),
      cancel: vi.fn(),
      onProgress: () => () => {},
    },
    ...over,
  };
};

beforeEach(() => {
  useScheduleStore.setState({
    teams: [], selectedTeamId: null, rows: [], status: 'idle', error: null, stats: null,
  });
  useSaveSlotsStore.setState({
    slots: [], status: 'idle', error: null, openedSlotId: 'slot-1',
  });
});

describe('<ScheduleView />', () => {
  it('loads teams on mount and populates the dropdown', async () => {
    makeVcd();
    render(<ScheduleView />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select team/i })).toBeInTheDocument());
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  it('selecting a team fetches and renders their schedule rows', async () => {
    makeVcd();
    const user = userEvent.setup();
    render(<ScheduleView />);
    await screen.findByRole('combobox', { name: /select team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /select team/i }), 't1');
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
    expect(screen.getByText('2026-08-28')).toBeInTheDocument();
    expect(screen.getByText('2026-09-25')).toBeInTheDocument();
  });

  it('Sprint 27 Task 27.1: no manual Generate button is rendered', async () => {
    makeVcd();
    render(<ScheduleView />);
    await screen.findByRole('combobox', { name: /select team/i });
    expect(screen.queryByRole('button', { name: /generate 2026 schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate.*schedule/i })).not.toBeInTheDocument();
  });

  it('axe-clean', async () => {
    makeVcd();
    const { container } = render(<ScheduleView />);
    await screen.findByRole('combobox', { name: /select team/i });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
