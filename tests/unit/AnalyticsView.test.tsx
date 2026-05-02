import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AnalyticsView } from '../../app/src/screens/AnalyticsView';
import { useAnalyticsStore } from '../../app/src/store/useAnalyticsStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

// Recharts uses ResponsiveContainer which needs a parent with a fixed
// width/height in jsdom. Mock it to render children directly.
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 280 }}>{children}</div>
    ),
  };
});

const HOME_LINEUP = ['Smith', 'Jones', 'Lee', 'Brown', 'Park', 'Davis'] as const;
const AWAY_LINEUP = ['Adams', 'Baker', 'Cole', 'Diaz', 'Evans', 'Frye'] as const;

function makeAnalyticsResponse() {
  const emptyPlayer = (slot: number) => ({
    slotIndex: slot,
    kills: slot === 1 ? 12 : 0,
    errors: 0,
    totalAttacks: slot === 1 ? 24 : 0,
    hittingPctMilli: slot === 1 ? 500 : 0,
    assists: 0,
    serviceAces: 0,
    serviceErrors: 0,
    receptionErrors: 0,
    digs: 0,
    blockSolos: 0,
    blockAssists: 0,
    rotationMinutes: 100,
  });
  return {
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
      primaryColor: '#ff6b2c',
      secondaryColor: '#222',
      lineupSlots: [...HOME_LINEUP] as [string, string, string, string, string, string],
      lineupRatingsBlock: [70, 65, 80, 60, 75, 55],
      lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
      lineupPlayerIds: ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'],
    },
    away: {
      teamId: 't-2',
      teamName: 'Beta',
      teamAbbr: 'BETA',
      primaryColor: '#3aa9ff',
      secondaryColor: '#444',
      lineupSlots: [...AWAY_LINEUP] as [string, string, string, string, string, string],
      lineupRatingsBlock: [60, 70, 75, 65, 80, 55],
      lineupPositions: ['S', 'OH', 'MB', 'OPP', 'MB', 'L'],
      lineupPlayerIds: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'],
    },
    boxScore: {
      home: {
        team: 'home' as const,
        players: [0, 1, 2, 3, 4, 5].map(emptyPlayer),
        totals: { ...emptyPlayer(0), slotIndex: -1 as const, kills: 12, totalAttacks: 24, hittingPctMilli: 500 },
      },
      away: {
        team: 'away' as const,
        players: [0, 1, 2, 3, 4, 5].map(emptyPlayer),
        totals: { ...emptyPlayer(0), slotIndex: -1 as const, kills: 12, totalAttacks: 24, hittingPctMilli: 500 },
      },
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
                { kind: 'serve' as const, tick: 0, team: 'home' as const, server: 0, quality: 'in_play' as const },
                { kind: 'reception' as const, tick: 1, team: 'away' as const, receiver: 3, grade: 2 as const },
                { kind: 'point' as const, tick: 2, winner: 'home' as const, reason: 'kill' as const },
              ],
            },
          ],
        },
      ],
    },
    timeline: { timeouts: [], substitutions: [] },
    sets: [{ index: 0, home: 25, away: 18, durationSec: 1200 }],
    setsPlayed: 1,
  };
}

function setupVcd() {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {
      listTeams: vi.fn(),
      simulate: vi.fn(),
      getById: vi.fn(),
      getAnalytics: vi.fn().mockResolvedValue(makeAnalyticsResponse()),
      listRecentMatches: vi.fn().mockResolvedValue({
        ok: true,
        matches: [
          {
            matchId: 'm-1',
            date: new Date().toISOString(),
            week: 5,
            homeTeamId: 't-1',
            homeName: 'Alpha',
            homeAbbr: 'ALPH',
            homeSetsWon: 3,
            awayTeamId: 't-2',
            awayName: 'Beta',
            awayAbbr: 'BETA',
            awaySetsWon: 1,
            isTournament: false,
          },
        ],
      }),
    },
    schedule: {} as Window['vcd']['schedule'],
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
    scout: {} as Window['vcd']['scout'],
  };
}

beforeEach(() => {
  setupVcd();
  useAnalyticsStore.getState().reset();
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
});

describe('<AnalyticsView />', () => {
  it('loads recent matches and renders the match selector', async () => {
    render(<AnalyticsView />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /match/i })).toBeInTheDocument(),
    );
  });

  it('after selecting a match, renders all 5 chart figures', async () => {
    render(<AnalyticsView />);
    await waitFor(() => screen.getByLabelText(/Hitting percentage by rotation/i), { timeout: 5000 });
    expect(screen.getByLabelText(/Kills per set vs opponent block rating/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reception grade distribution per player/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Serve location heat map/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rally length distribution/i)).toBeInTheDocument();
  });

  it('shows error alert when listRecentMatches fails', async () => {
    (window as unknown as { vcd: Window['vcd'] }).vcd.match.listRecentMatches = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { code: 'IO_ERROR', message: 'disk full' } });
    render(<AnalyticsView />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('disk full'));
  });
});
