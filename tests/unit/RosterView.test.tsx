// Sprint 28 Tasks 28.1 + 28.2.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { RosterView } from '../../app/src/screens/RosterView';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';
import { useUserTeamStore } from '../../app/src/store/useUserTeamStore';
import { useScheduleStore } from '../../app/src/store/useScheduleStore';
import { useRosterStore } from '../../app/src/store/useRosterStore';
import type { matchIpc, rosterIpc } from '@vcd/shared';

const team: matchIpc.TeamSummary = {
  id: 'tA',
  schoolName: 'Stanford',
  abbr: 'STAN',
  conferenceId: 'acc',
  primaryColor: '#8C1515',
  secondaryColor: '#FFFFFF',
  prestige: 90,
};

const mkPlayer = (overrides: Partial<rosterIpc.RosterPlayer> = {}): rosterIpc.RosterPlayer => ({
  id: 'p1',
  jersey: 1,
  firstName: 'Jane',
  lastName: 'Smith',
  position: 'OH',
  classYear: 'JR',
  height: 188,
  isLibero: false,
  isCaptain: false,
  redshirtUsed: false,
  overall: 85,
  potential: 90,
  ...overrides,
});

const mkProfile = (): rosterIpc.PlayerProfile => ({
  id: 'p1',
  firstName: 'Jane',
  lastName: 'Smith',
  jersey: 1,
  position: 'OH',
  classYear: 'JR',
  height: 188,
  hometownCity: null,
  hometownState: null,
  isLibero: false,
  isCaptain: false,
  redshirtUsed: false,
  overall: 85,
  potential: 90,
  ratings: {
    attack: 88,
    block: 70,
    serve: 80,
    pass: 75,
    set: 50,
    dig: 70,
    athleticism: 85,
    iq: 80,
    stamina: 82,
  },
  teamAbbr: 'STAN',
  teamSchool: 'Stanford',
  currentSeasonStats: {
    setsPlayed: 60,
    matchesPlayed: 20,
    kills: 240,
    errors: 60,
    totalAttacks: 600,
    hittingPctMilli: 300,
    digs: 80,
    blocks: 30,
    aces: 25,
    assists: 15,
  },
  careerStats: {
    setsPlayed: 180,
    matchesPlayed: 60,
    kills: 700,
    errors: 200,
    totalAttacks: 1800,
    hittingPctMilli: 278,
    digs: 250,
    blocks: 90,
    aces: 70,
    assists: 40,
  },
});

function setupVcd(players: rosterIpc.RosterPlayer[]) {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    roster: {
      listForTeam: vi.fn().mockResolvedValue({ ok: true, players }),
      getProfile: vi.fn().mockResolvedValue({ ok: true, profile: mkProfile() }),
    },
    match: {
      seasonAnalytics: vi.fn().mockResolvedValue({
        ok: true,
        team: {
          teamId: 'tA',
          teamAbbr: 'STAN',
          teamSchool: 'Stanford',
          seasonYear: 2026,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          setsWon: 0,
          setsLost: 0,
          teamHittingPctMilli: 0,
          oppHittingPctMilli: 0,
          totalKills: 0,
          totalAces: 0,
          totalBlocks: 0,
          totalDigs: 0,
        },
        trend: [],
        players: players.map((p) => ({
          playerId: p.id,
          playerName: `${p.firstName} ${p.lastName}`,
          position: p.position,
          setsPlayed: 60,
          matchesPlayed: 20,
          kills: 240,
          errors: 60,
          totalAttacks: 600,
          hittingPctMilli: 300,
          killsPerSetMilli: 4000,
          digs: 80,
          blocks: 30,
          aces: 25,
          assists: 15,
        })),
      }),
    },
    // Other namespaces are unused by RosterView.
  } as unknown as Window['vcd'];
}

beforeEach(() => {
  useSaveSlotsStore.setState({ openedSlotId: 'slot-1' });
  useUserTeamStore.setState({ userTeamId: 'tA', status: 'ready', error: null });
  useScheduleStore.setState({
    teams: [team],
    selectedTeamId: null,
    rows: [],
    status: 'ready',
    error: null,
    stats: null,
  });
  useRosterStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RosterView', () => {
  it('renders rows for every player', async () => {
    setupVcd([
      mkPlayer({ id: 'p1', firstName: 'Anna', lastName: 'A', position: 'S' }),
      mkPlayer({ id: 'p2', firstName: 'Beth', lastName: 'B', position: 'OH' }),
      mkPlayer({ id: 'p3', firstName: 'Cara', lastName: 'C', position: 'MB' }),
    ]);
    render(<RosterView />);
    await waitFor(() => {
      expect(screen.getByTestId('roster-row-p1')).toBeInTheDocument();
      expect(screen.getByTestId('roster-row-p2')).toBeInTheDocument();
      expect(screen.getByTestId('roster-row-p3')).toBeInTheDocument();
    });
  });

  it('clicking a row opens the profile modal with the player data', async () => {
    setupVcd([mkPlayer({ id: 'p1', firstName: 'Jane', lastName: 'Smith' })]);
    render(<RosterView />);
    const row = await screen.findByTestId('roster-row-p1');
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('player-profile-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('player-profile-ovr')).toHaveTextContent('85');
  });

  it('Enter key on a row also opens the profile modal', async () => {
    setupVcd([mkPlayer({ id: 'p1' })]);
    render(<RosterView />);
    const row = await screen.findByTestId('roster-row-p1');
    fireEvent.keyDown(row, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByTestId('player-profile-modal')).toBeInTheDocument();
    });
  });

  it('ESC closes the profile modal', async () => {
    setupVcd([mkPlayer({ id: 'p1' })]);
    render(<RosterView />);
    fireEvent.click(await screen.findByTestId('roster-row-p1'));
    await screen.findByTestId('player-profile-modal');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('player-profile-modal')).not.toBeInTheDocument();
    });
  });

  it('axe-core: zero violations on the roster table', async () => {
    setupVcd([
      mkPlayer({ id: 'p1', firstName: 'A', lastName: 'A', position: 'S' }),
      mkPlayer({ id: 'p2', firstName: 'B', lastName: 'B', position: 'OH' }),
    ]);
    const { container } = render(<RosterView />);
    await screen.findByTestId('roster-row-p1');
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('toggling to Stats mode renders the stats table with kills/digs columns', async () => {
    setupVcd([
      mkPlayer({ id: 'p1', firstName: 'Anna', lastName: 'A', position: 'OH' }),
    ]);
    render(<RosterView />);
    await screen.findByTestId('roster-row-p1');
    fireEvent.click(screen.getByTestId('roster-mode-stats'));
    await waitFor(() => {
      expect(screen.getByTestId('roster-stats-table')).toBeInTheDocument();
      expect(screen.getByTestId('roster-stats-row-p1')).toBeInTheDocument();
    });
    // The mocked seasonAnalytics returns 240 kills + .300 hitting %.
    const statsRow = screen.getByTestId('roster-stats-row-p1');
    expect(statsRow).toHaveTextContent('240');
    expect(statsRow).toHaveTextContent('.300');
  });

  it('shows a "pick your team" message when userTeamId is null', () => {
    useUserTeamStore.setState({ userTeamId: null });
    setupVcd([]);
    render(<RosterView />);
    expect(screen.getByText(/Pick your team from the Hub/i)).toBeInTheDocument();
  });
});
