// Sprint 26 Task 26.5 tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import { SeasonHub } from '../../app/src/screens/SeasonHub';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useSeasonStore } from '../../app/src/store/useSeasonStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';
import { useScheduleStore } from '../../app/src/store/useScheduleStore';
import { useNavStore } from '../../app/src/store/useNavStore';
import type { matchIpc } from '@vcd/shared';

const makeTeam = (id: string, name: string, abbr: string): matchIpc.TeamSummary => ({
  id,
  schoolName: name,
  abbr,
  conferenceId: 'sec',
  primaryColor: '#111111',
  secondaryColor: '#222222',
  prestige: 75,
});

function setupVcd(opts: { season?: { phase: string; currentWeek: number } } = {}) {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: vi.fn().mockResolvedValue({
        ok: true,
        teams: [makeTeam('t-1', 'Stanford', 'STAN'), makeTeam('t-2', 'Wisconsin', 'WISC')],
      }),
    } as unknown as Window['vcd']['match'],
    schedule: {} as Window['vcd']['schedule'],
    season: {
      getCurrentWeek: vi.fn().mockResolvedValue({
        ok: true,
        currentWeek: opts.season?.currentWeek ?? 0,
        phase: opts.season?.phase ?? 'PRESEASON',
      }),
      getUserTeam: vi.fn().mockResolvedValue({ ok: true, userTeamId: 't-1' }),
      setUserTeam: vi.fn(),
      advanceWeek: vi.fn(),
      onProgress: vi.fn().mockReturnValue(() => undefined),
      cancel: vi.fn(),
    } as unknown as Window['vcd']['season'],
    poll: {} as Window['vcd']['poll'],
    bracket: {} as Window['vcd']['bracket'],
    postseason: {} as Window['vcd']['postseason'],
    recruiting: {} as Window['vcd']['recruiting'],
    portal: {} as Window['vcd']['portal'],
    nil: {} as Window['vcd']['nil'],
    offseason: {} as Window['vcd']['offseason'],
    coaching: {} as Window['vcd']['coaching'],
    awards: {} as Window['vcd']['awards'],
    scout: {} as Window['vcd']['scout'],
    crash: {} as Window['vcd']['crash'],
    update: {} as Window['vcd']['update'],
  } as unknown as Window['vcd'];
}

beforeEach(() => {
  setupVcd();
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
  useSeasonStore.setState({
    currentWeek: 0,
    phase: 'PRESEASON',
    status: 'idle',
    error: null,
    progress: null,
    cancellationId: null,
    lastAdvanceElapsedMs: null,
  });
  useUserTeamStore.setState({ userTeamId: 't-1', status: 'ready', error: null });
  useScheduleStore.setState({
    teams: [makeTeam('t-1', 'Stanford', 'STAN'), makeTeam('t-2', 'Wisconsin', 'WISC')],
    selectedTeamId: null,
    rows: [],
    status: 'ready',
    error: null,
    stats: null,
  });
  useNavStore.setState({ screen: 'season-hub' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<SeasonHub />', () => {
  it('header renders the user team school name + phase chip', () => {
    render(<SeasonHub />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stanford');
    expect(screen.getByTestId('season-hub-phase')).toHaveTextContent(/Pre-season · PRESEASON/);
  });

  it('renders REGULAR season phase chip', () => {
    useSeasonStore.setState({ phase: 'REGULAR', currentWeek: 3 });
    render(<SeasonHub />);
    expect(screen.getByTestId('season-hub-phase')).toHaveTextContent(/Week 3 · REGULAR/);
  });

  it('action cards visible: Recruiting + Portal + Schedule + Match Hub always', () => {
    render(<SeasonHub />);
    expect(screen.getByTestId('action-recruiting')).toBeInTheDocument();
    expect(screen.getByTestId('action-portal')).toBeInTheDocument();
    expect(screen.getByTestId('action-schedule')).toBeInTheDocument();
    expect(screen.getByTestId('action-match-hub')).toBeInTheDocument();
  });

  it('Bracket card hidden in REGULAR', () => {
    render(<SeasonHub />);
    expect(screen.queryByTestId('action-bracket')).not.toBeInTheDocument();
  });

  it('Bracket card visible in NCAA postseason', () => {
    useSeasonStore.setState({ phase: 'NCAA', currentWeek: 18 });
    render(<SeasonHub />);
    expect(screen.getByTestId('action-bracket')).toBeInTheDocument();
  });

  it('Awards card hidden in REGULAR', () => {
    render(<SeasonHub />);
    expect(screen.queryByTestId('action-awards')).not.toBeInTheDocument();
  });

  it('Awards card visible in OFFSEASON', () => {
    useSeasonStore.setState({ phase: 'OFFSEASON', currentWeek: 21 });
    render(<SeasonHub />);
    expect(screen.getByTestId('action-awards')).toBeInTheDocument();
  });

  it('clicking an action card routes via useNavStore.setScreen', () => {
    render(<SeasonHub />);
    fireEvent.click(screen.getByTestId('action-recruiting'));
    expect(useNavStore.getState().screen).toBe('recruiting');
  });

  it('legacy save fallback (userTeamId === null) shows banner with Match Hub CTA', () => {
    useUserTeamStore.setState({ userTeamId: null, status: 'ready', error: null });
    render(<SeasonHub />);
    expect(screen.getByTestId('legacy-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to match hub/i }));
    expect(useNavStore.getState().screen).toBe('match-hub');
  });

  it('axe-core: zero violations in PRESEASON', async () => {
    const { container } = render(<SeasonHub />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('axe-core: zero violations in NCAA postseason', async () => {
    useSeasonStore.setState({ phase: 'NCAA', currentWeek: 18 });
    const { container } = render(<SeasonHub />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
