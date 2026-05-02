import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { BracketView } from '../../app/src/screens/BracketView';
import { usePostseasonStore } from '../../app/src/store/usePostseasonStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useNavStore } from '../../app/src/store/useNavStore';

type Match = {
  matchId: string;
  round: string;
  bracketSlot: number;
  bracketGroupKey: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeamSchool: string;
  awayTeamSchool: string;
  winnerId: string | null;
  setScores: Array<{ home: number; away: number }>;
};

function mkMatch(over: Partial<Match> = {}): Match {
  return {
    matchId: `m${crypto.randomUUID().slice(0, 7)}`,
    round: 'CT_R1',
    bracketSlot: 0,
    bracketGroupKey: 'C1',
    homeTeamId: 'A',
    awayTeamId: 'B',
    homeTeamAbbr: 'AAA',
    awayTeamAbbr: 'BBB',
    homeTeamSchool: 'Alpha',
    awayTeamSchool: 'Bravo',
    winnerId: null,
    setScores: [],
    ...over,
  };
}

function makeVcd(over: Partial<Window['vcd']['postseason']> = {}) {
  const defaults: Window['vcd']['postseason'] = {
    startCt: vi.fn().mockResolvedValue({ ok: true, matchesCreated: 0 }),
    startNcaa: vi.fn().mockResolvedValue({ ok: true, r64MatchesCreated: 32, autoBidCount: 32 }),
    advanceRound: vi.fn().mockResolvedValue({
      ok: true,
      round: 'CT_R1',
      matchesPlayed: 4,
      nextRoundCreated: 2,
    }),
    getState: vi.fn().mockResolvedValue({
      ok: true,
      phase: 'NCAA',
      seasonYear: 2026,
      championTeamId: null,
      championTeamSchool: null,
      matches: [
        mkMatch({ round: 'NCAA_R64', bracketGroupKey: 'REGION_1', bracketSlot: 0 }),
        mkMatch({ round: 'NCAA_R64', bracketGroupKey: 'REGION_3', bracketSlot: 0 }),
      ],
    }),
  };
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {} as Window['vcd']['match'],
    schedule: {} as Window['vcd']['schedule'],
    season: {} as Window['vcd']['season'],
    poll: {} as Window['vcd']['poll'],
    bracket: {} as Window['vcd']['bracket'],
    postseason: { ...defaults, ...over },
  };
}

beforeEach(() => {
  usePostseasonStore.setState({
    phase: 'REGULAR',
    seasonYear: 2026,
    championTeamId: null,
    championTeamSchool: null,
    matches: [],
    status: 'idle',
    error: null,
    view: 'conf',
    selectedRegion: 'REGION_1',
    selectedConferenceId: null,
  });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  useNavStore.setState({ screen: 'bracket' });
});

describe('<BracketView />', () => {
  it('renders post-season heading and phase', async () => {
    makeVcd();
    render(<BracketView />);
    await waitFor(() => expect(screen.getByText(/Phase: NCAA/)).toBeInTheDocument());
  });

  it('NCAA view shows 4 region tabs + Final Four', async () => {
    makeVcd();
    render(<BracketView />);
    await waitFor(() => expect(screen.getByText(/Phase: NCAA/)).toBeInTheDocument());
    // Switch to NCAA view.
    fireEvent.click(screen.getByRole('button', { name: /NCAA Bracket/ }));
    const tablist = await screen.findByRole('tablist', { name: /Region/ });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(5); // 4 regions + Final Four
  });

  it('selecting a region preserves state after nav away and back', async () => {
    makeVcd();
    render(<BracketView />);
    await waitFor(() => expect(screen.getByText(/Phase: NCAA/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /NCAA Bracket/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Region 3/ }));
    expect(usePostseasonStore.getState().selectedRegion).toBe('REGION_3');
    // Simulate nav away and back — the store survives since it's a singleton.
    useNavStore.setState({ screen: 'poll' });
    useNavStore.setState({ screen: 'bracket' });
    expect(usePostseasonStore.getState().selectedRegion).toBe('REGION_3');
    expect(usePostseasonStore.getState().view).toBe('ncaa');
  });

  it('advance button calls advanceRound IPC', async () => {
    const advance = vi.fn().mockResolvedValue({
      ok: true,
      round: 'NCAA_R64',
      matchesPlayed: 32,
      nextRoundCreated: 16,
    });
    makeVcd({ advanceRound: advance });
    render(<BracketView />);
    await waitFor(() => expect(screen.getByText(/Phase: NCAA/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /NCAA Bracket/ }));
    const advBtn = await screen.findByRole('button', { name: /Advance R64/ });
    fireEvent.click(advBtn);
    await waitFor(() => expect(advance).toHaveBeenCalledWith('slot-1', 'NCAA_R64'));
  });

  it('axe-clean', async () => {
    makeVcd();
    const { container } = render(<BracketView />);
    await waitFor(() => expect(screen.getByText(/Phase: NCAA/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /NCAA Bracket/ }));
    await screen.findByRole('tablist', { name: /Region/ });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
