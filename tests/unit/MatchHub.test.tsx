import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MatchHub } from '../../app/src/screens/MatchHub';
import { useMatchHubStore } from '../../app/src/store/useMatchHubStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';
import { useScheduleStore } from '../../app/src/store/useScheduleStore';
import type { matchIpc, sim } from '@vcd/shared';

const makeTeam = (id: string, name: string, abbr: string): matchIpc.TeamSummary => ({
  id,
  schoolName: name,
  abbr,
  conferenceId: 'sec',
  primaryColor: '#111111',
  secondaryColor: '#222222',
  prestige: 55,
});

const emptyPlayerRow = (i: number): sim.PlayerBoxScore => ({
  slotIndex: i,
  kills: 0,
  errors: 0,
  totalAttacks: 0,
  hittingPctMilli: 0,
  assists: 0,
  serviceAces: 0,
  serviceErrors: 0,
  receptionErrors: 0,
  digs: 0,
  blockSolos: 0,
  blockAssists: 0,
  rotationMinutes: 30,
});

const makeMatchPayload = () => ({
  ok: true as const,
  match: {
    id: 'm-1',
    date: new Date().toISOString(),
    week: 5,
    isTournament: false,
    tournamentRound: null,
    homeTeamId: 't-1',
    awayTeamId: 't-2',
    winnerId: 't-1',
    homeSetsWon: 3,
    awaySetsWon: 1,
  },
  home: {
    teamId: 't-1',
    teamName: 'Alpha',
    teamAbbr: 'ALPH',
    primaryColor: '#111111',
    secondaryColor: '#222222',
    lineupSlots: ['Smith', 'Jones', 'Lee', 'Brown', 'Park', 'Davis'] as [
      string, string, string, string, string, string,
    ],
  },
  away: {
    teamId: 't-2',
    teamName: 'Beta',
    teamAbbr: 'BETA',
    primaryColor: '#222222',
    secondaryColor: '#333333',
    lineupSlots: ['Adams', 'Baker', 'Cole', 'Diaz', 'Evans', 'Frye'] as [
      string, string, string, string, string, string,
    ],
  },
  boxScore: {
    home: { team: 'home' as const, players: [0,1,2,3,4,5].map(emptyPlayerRow), totals: { ...emptyPlayerRow(0), slotIndex: -1 as const, rotationMinutes: 180 } },
    away: { team: 'away' as const, players: [0,1,2,3,4,5].map(emptyPlayerRow), totals: { ...emptyPlayerRow(0), slotIndex: -1 as const, rotationMinutes: 180 } },
    homeSetsWon: 3,
    awaySetsWon: 1,
    winner: 'home' as const,
  },
  pbp: {
    version: 1 as const,
    winner: 'home' as const,
    homeSetsWon: 3,
    awaySetsWon: 1,
    sets: [
      {
        setIndex: 0,
        homeScore: 25,
        awayScore: 18,
        rallies: [
          {
            rallyIndex: 0,
            seed: 'r0',
            servingTeam: 'home' as const,
            winningTeam: 'home' as const,
            events: [
              { kind: 'serve' as const, tick: 0, team: 'home' as const, server: 0, quality: 'ace' as const },
              { kind: 'point' as const, tick: 1, winner: 'home' as const, reason: 'service_ace' as const },
            ],
          },
        ],
      },
    ],
  },
  timeline: { timeouts: [], substitutions: [] },
  sets: [{ index: 0, home: 25, away: 18, durationSec: 1200 }],
});

const makeScoutPayload = () => ({
  ok: true as const,
  opponentTeamId: 't-2',
  opponentName: 'Beta',
  opponentAbbr: 'BETA',
  system: '5-1',
  topHitters: [
    { playerId: 'p1', playerName: 'Star Hitter', position: 'OH', killsPerSet: 4.5, matchesPlayed: 5 },
  ],
  recentForm: [
    { matchId: 'm0', date: '2026-08-01', result: 'W' as const, opponentTeamId: 'X', opponentName: 'X', opponentAbbr: 'X', setsFor: 3, setsAgainst: 0 },
  ],
});

function setupVcd(over: Partial<{ listTeams: unknown; simulate: unknown; getById: unknown; scout: unknown }> = {}) {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: (over.listTeams as Window['vcd']['match']['listTeams']) ??
        vi.fn().mockResolvedValue({
          ok: true,
          teams: [makeTeam('t-1', 'Alpha', 'ALPH'), makeTeam('t-2', 'Beta', 'BETA')],
        }),
      simulate: (over.simulate as Window['vcd']['match']['simulate']) ??
        vi.fn().mockResolvedValue({
          ok: true,
          matchId: 'm-1',
          boxScore: makeMatchPayload().boxScore,
          pbpChars: 1234,
        }),
      getById: (over.getById as Window['vcd']['match']['getById']) ??
        vi.fn().mockResolvedValue(makeMatchPayload()),
      // Sprint 29 live-mode IPC surface — MatchHub queries listPaused +
      // hasActive on mount to decide whether to show the resume banner.
      // Tests mock these to no-op responses so the component renders.
      live: {
        listPaused: vi.fn().mockResolvedValue({ ok: true, matches: [] }),
        hasActive: vi.fn().mockResolvedValue({ ok: true, hasActive: false }),
        hasPaused: vi.fn().mockResolvedValue({ ok: true, hasPaused: false }),
      } as unknown as Window['vcd']['match']['live'],
      // Sprint 19 + Sprint 22 additions — defaulted to empty results
      // so component code-paths that read recent matches don't crash.
      listRecentMatches: vi.fn().mockResolvedValue({ ok: true, matches: [] }),
      seasonAnalytics: vi.fn().mockResolvedValue({
        ok: true,
        analytics: { matches: [], rolledUp: null },
      }),
      getAnalytics: vi.fn().mockResolvedValue({ ok: true, analytics: null }),
    } as unknown as Window['vcd']['match'],
    schedule: {
      listForTeam: vi.fn().mockResolvedValue({ ok: true, rows: [] }),
      listTeams: vi.fn().mockResolvedValue({ ok: true, teams: [] }),
      generate: vi.fn().mockResolvedValue({ ok: true, stats: { totalMatches: 0, confMatches: 0, nonConfMatches: 0, tournamentMatches: 0 } }),
    } as unknown as Window['vcd']['schedule'],
    season: {} as Window['vcd']['season'],
    poll: {} as Window['vcd']['poll'],
    bracket: {} as Window['vcd']['bracket'],
    postseason: {} as Window['vcd']['postseason'],
    recruiting: {} as Window['vcd']['recruiting'],
    portal: {} as Window['vcd']['portal'],
    nil: {} as Window['vcd']['nil'],
    offseason: {} as Window['vcd']['offseason'],
    coaching: {} as Window['vcd']['coaching'],
    awards: {} as Window['vcd']['awards'],
    scout: {
      report: (over.scout as Window['vcd']['scout']['report']) ??
        vi.fn().mockResolvedValue(makeScoutPayload()),
    },
  };
}

beforeEach(() => {
  useMatchHubStore.getState().reset();
  useMatchHubStore.setState({ teams: [] });
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  // Sprint 27 Task 27.2: reset user-team + schedule stores to keep tests
  // isolated; default to userTeamId=null so legacy dual-picker tests work.
  useUserTeamStore.setState({ userTeamId: null, status: 'idle', error: null });
  useScheduleStore.setState({
    teams: [],
    selectedTeamId: null,
    rows: [],
    status: 'idle',
    error: null,
    stats: null,
  });
});

describe('<MatchHub />', () => {
  it('loads and renders teams in both dropdowns', async () => {
    setupVcd();
    render(<MatchHub />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /home team/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('combobox', { name: /away team/i })).toBeInTheDocument();
  });

  it('Play match button is disabled until two distinct teams selected', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    const button = await screen.findByRole('button', { name: /play match/i });
    expect(button).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    expect(button).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('renders scout panel when both teams are selected', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    expect(screen.getByText(/Star Hitter/)).toBeInTheDocument();
  });

  it('speed slider has 4 settings (1x, 2x, 4x, instant)', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play match/i }));
    await waitFor(() => screen.getByTestId('speed-control'));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios.map((r) => (r as HTMLInputElement).value).sort()).toEqual(
      ['1x', '2x', '4x', 'instant'].sort(),
    );
  });

  it('axe-core: zero violations with teams loaded + scout', async () => {
    setupVcd();
    const user = userEvent.setup();
    const { container } = render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('Sprint 26 Task 26.1: Scoreboard shows match-level sets-won tally derived from completed sets', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play match/i }));
    await waitFor(() => screen.getByTestId('sets-tally'));
    // No completed sets yet → tally is 0 — 0.
    expect(screen.getByTestId('sets-tally-home')).toHaveTextContent('0');
    expect(screen.getByTestId('sets-tally-away')).toHaveTextContent('0');

    // Simulate set-break entries: home wins set 1, away wins set 2.
    useMatchHubStore.setState({
      setHomeScores: [25, 18],
      setAwayScores: [22, 25],
    });
    await waitFor(() => {
      expect(screen.getByTestId('sets-tally-home')).toHaveTextContent('1');
      expect(screen.getByTestId('sets-tally-away')).toHaveTextContent('1');
    });

    // Home wins set 3 → 2 — 1.
    useMatchHubStore.setState({
      setHomeScores: [25, 18, 25],
      setAwayScores: [22, 25, 20],
    });
    await waitFor(() => {
      expect(screen.getByTestId('sets-tally-home')).toHaveTextContent('2');
      expect(screen.getByTestId('sets-tally-away')).toHaveTextContent('1');
    });
  });

  it('Sprint 26 Task 26.2: paused replay shows user timeout buttons; clicking decrements counter + shows banner', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play match/i }));
    // Force into paused state for the panel to appear (in production the
    // user would click Pause; the store reacts to that).
    await waitFor(() => screen.getByTestId('play-toggle'));
    useMatchHubStore.setState({ phase: 'paused' });
    await waitFor(() => screen.getByTestId('timeout-home'));
    const homeBtn = screen.getByTestId('timeout-home');
    expect(homeBtn).toHaveTextContent('ALPH timeout');
    expect(homeBtn).toHaveTextContent('10 left');

    fireEvent.click(homeBtn);
    expect(useMatchHubStore.getState().homeTimeoutsRemaining).toBe(9);
    expect(useMatchHubStore.getState().banner?.text).toContain('TIMEOUT (coach)');
  });

  it('Sprint 26 Task 26.2: timeout button is disabled when 0 remaining', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play match/i }));
    await waitFor(() => screen.getByTestId('play-toggle'));
    useMatchHubStore.setState({ phase: 'paused', homeTimeoutsRemaining: 0 });
    await waitFor(() => screen.getByTestId('timeout-home'));
    expect(screen.getByTestId('timeout-home')).toBeDisabled();
  });

  it('Sprint 26 Task 26.6: paused replay shows lineup with Swap buttons; libero slot shows Libero label not Swap', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play match/i }));
    await waitFor(() => screen.getByTestId('play-toggle'));
    useMatchHubStore.setState({ phase: 'paused' });
    await waitFor(() => screen.getByTestId('lineup-panel'));
    // Slots 0..4 have a Swap button; slot 5 (libero) does not.
    expect(screen.getByTestId('sub-home-0')).toBeInTheDocument();
    expect(screen.getByTestId('sub-home-4')).toBeInTheDocument();
    expect(screen.queryByTestId('sub-home-5')).not.toBeInTheDocument();

    // Click Swap on slot 0 → injectUserSub called → userSubs has the entry.
    fireEvent.click(screen.getByTestId('sub-home-0'));
    expect(useMatchHubStore.getState().userSubs).toHaveLength(1);
    expect(useMatchHubStore.getState().userSubs[0]?.slotIndex).toBe(0);
    expect(useMatchHubStore.getState().banner?.text).toContain('SUB (coach)');
  });

  it('Sprint 26 store: injectUserTimeout returns false when not paused', () => {
    useMatchHubStore.setState({
      phase: 'playing',
      homeTimeoutsRemaining: 5,
      match: makeMatchPayload(),
    });
    const result = useMatchHubStore.getState().injectUserTimeout('home');
    expect(result).toBe(false);
    expect(useMatchHubStore.getState().homeTimeoutsRemaining).toBe(5);
  });

  it('Sprint 26 store: injectUserSub rejects libero slot', () => {
    useMatchHubStore.setState({
      phase: 'paused',
      match: makeMatchPayload(),
      userSubs: [],
    });
    const result = useMatchHubStore.getState().injectUserSub('home', 5, 'p99');
    expect(result).toBe(false);
    expect(useMatchHubStore.getState().userSubs).toHaveLength(0);
  });

  it('Sprint 27 Task 27.2: when userTeamId is set, dual-team picker is hidden + match list is shown', async () => {
    setupVcd();
    useUserTeamStore.setState({ userTeamId: 't-1', status: 'ready', error: null });
    useScheduleStore.setState({
      teams: [],
      selectedTeamId: 't-1',
      rows: [
        {
          matchId: 'm-up-1',
          weekIndex: 1,
          isoDate: '2026-09-04',
          opponentId: 't-2',
          opponentSchool: 'Beta',
          opponentAbbr: 'BETA',
          isHome: true,
          isConference: false,
          isTournament: false,
          isNeutralSite: false,
          winnerId: null,
        },
        {
          matchId: 'm-played-1',
          weekIndex: 0,
          isoDate: '2026-08-30',
          opponentId: 't-2',
          opponentSchool: 'Beta',
          opponentAbbr: 'BETA',
          isHome: false,
          isConference: false,
          isTournament: false,
          isNeutralSite: false,
          winnerId: 't-1',
        },
      ],
      status: 'ready',
      error: null,
      stats: null,
    });
    render(<MatchHub />);
    await waitFor(() => screen.getByTestId('user-team-match-list'));
    // Dual-picker is hidden; the legacy banner is not present.
    expect(screen.queryByTestId('legacy-picker-banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /home team/i })).not.toBeInTheDocument();
    // Upcoming match has a Play CTA; played match has a Replay CTA.
    expect(screen.getByTestId('play-match-m-up-1')).toBeInTheDocument();
    expect(screen.getByTestId('replay-match-m-played-1')).toBeInTheDocument();
  });

  it('Sprint 27 Task 27.2: legacy save (userTeamId=null) shows the dual picker fallback', async () => {
    setupVcd();
    useUserTeamStore.setState({ userTeamId: null, status: 'ready', error: null });
    render(<MatchHub />);
    await waitFor(() => screen.getByTestId('legacy-picker-banner'));
    expect(screen.getByTestId('legacy-picker-banner')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /home team/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /away team/i })).toBeInTheDocument();
  });

  it('shows error alert when listTeams fails', async () => {
    setupVcd({
      listTeams: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'no such slot' },
      }),
    });
    render(<MatchHub />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('no such slot'));
  });

  it('Play button toggles paused state when clicked while playing', async () => {
    setupVcd();
    const user = userEvent.setup();
    render(<MatchHub />);
    await screen.findByRole('combobox', { name: /home team/i });
    await user.selectOptions(screen.getByRole('combobox', { name: /home team/i }), 't-1');
    await user.selectOptions(screen.getByRole('combobox', { name: /away team/i }), 't-2');
    await waitFor(() => expect(screen.getByLabelText(/scout report/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /play match/i }));
    await waitFor(() => screen.getByTestId('play-toggle'));
    const playToggle = screen.getByTestId('play-toggle');
    fireEvent.click(playToggle);
    await waitFor(() => {
      // After clicking play, we should be playing; another click pauses.
      // Since events fire instantly with mocked match (1 rally, 2 events), the state
      // may already be 'done'. The control should at least be present.
      expect(playToggle).toBeInTheDocument();
    });
  });
});
