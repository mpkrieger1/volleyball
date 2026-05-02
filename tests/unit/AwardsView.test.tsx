import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AwardsView } from '../../app/src/screens/AwardsView';
import { useAwardsStore } from '../../app/src/store/useAwardsStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

function entry(playerId: string, position: 'OH' | 'MB' | 'OPP' | 'S' | 'L', overrides: Record<string, unknown> = {}) {
  return {
    playerId,
    playerName: `Player ${playerId}`,
    position,
    isLibero: position === 'L',
    teamId: 'T1',
    teamName: 'Nebraska',
    teamAbbr: 'NEB',
    classYear: 'JR',
    primaryStat: { label: 'K/set', value: 4.2 },
    priorAaCount: 0,
    ...overrides,
  };
}

function makeFirstTeam() {
  return [
    entry('p1', 'OH'),
    entry('p2', 'OH'),
    entry('p3', 'MB', { primaryStat: { label: 'B/set', value: 1.2 } }),
    entry('p4', 'MB', { primaryStat: { label: 'B/set', value: 1.0 } }),
    entry('p5', 'OPP'),
    entry('p6', 'S', { primaryStat: { label: 'A/set', value: 11.5 } }),
    entry('p7', 'L', { primaryStat: { label: 'D/set', value: 4.7 } }),
  ];
}

function makeMockVcd() {
  (window as unknown as { vcd: Window['vcd'] }).vcd = {
    version: '0.1.0',
    saveSlots: {} as Window['vcd']['saveSlots'],
    match: {} as Window['vcd']['match'],
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
    awards: {
      listForSeason: vi.fn().mockResolvedValue({
        ok: true,
        seasonYear: 2026,
        teams: {
          first: makeFirstTeam(),
          second: makeFirstTeam().map((e) => ({
            ...e,
            playerId: `s_${e.playerId}`,
            playerName: `Player s_${e.playerId}`,
          })),
          third: makeFirstTeam().map((e) => ({
            ...e,
            playerId: `t_${e.playerId}`,
            playerName: `Player t_${e.playerId}`,
          })),
          hm: makeFirstTeam().map((e) => ({
            ...e,
            playerId: `h_${e.playerId}`,
            playerName: `Player h_${e.playerId}`,
          })),
        },
        availableSeasons: [2026],
      }),
      careerForPlayer: vi.fn().mockResolvedValue({
        ok: true,
        playerId: 'p1',
        awards: [
          { seasonYear: 2025, category: 'AA_SECOND', team: 'second' },
          { seasonYear: 2026, category: 'AA_FIRST', team: 'first' },
        ],
      }),
    } as Window['vcd']['awards'],
  };
}

beforeEach(() => {
  makeMockVcd();
  useSaveSlotsStore.setState({ openedSlotId: 'slot-1' });
  useAwardsStore.getState().reset();
});

describe('AwardsView', () => {
  it('renders 7 players in the active tab (1st by default)', async () => {
    render(<AwardsView />);
    await waitFor(() =>
      expect(screen.getByRole('tabpanel', { name: '1st Team' })).toBeInTheDocument(),
    );
    const rows = screen.getAllByRole('button', { name: /Player/i });
    expect(rows).toHaveLength(7);
  });

  it('switching tabs changes the visible player list', async () => {
    render(<AwardsView />);
    await waitFor(() => screen.getByRole('tab', { name: '2nd Team' }));
    fireEvent.click(screen.getByRole('tab', { name: '2nd Team' }));
    await waitFor(() => screen.getByRole('tabpanel', { name: '2nd Team' }));
    const rows = screen.getAllByRole('button', { name: /Player s_/i });
    expect(rows.length).toBe(7);
  });

  it('position filter narrows visible rows', async () => {
    render(<AwardsView />);
    await waitFor(() => screen.getByRole('tabpanel', { name: '1st Team' }));
    // Uncheck OH, MB, OPP, S — leaving just L (1 player).
    fireEvent.click(screen.getByLabelText('OH'));
    fireEvent.click(screen.getByLabelText('MB'));
    fireEvent.click(screen.getByLabelText('OPP'));
    fireEvent.click(screen.getByLabelText('S'));
    const remaining = screen.getAllByRole('button', { name: /Player p7/i });
    expect(remaining.length).toBe(1);
  });

  it('clicking a player row expands inline career history', async () => {
    render(<AwardsView />);
    await waitFor(() => screen.getByRole('tabpanel', { name: '1st Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Player p1' }));
    await waitFor(() => screen.getByText('Career AA history:'));
    // Use specific patterns that match only career-list <li> text (not the
    // table caption "1st Team — 2026 season").
    expect(screen.getByText(/2025 — 2nd Team/)).toBeInTheDocument();
    expect(screen.getByText(/2026 — 1st Team/)).toBeInTheDocument();
  });

  it('axe-core: zero violations', async () => {
    const { container } = render(<AwardsView />);
    await waitFor(() => screen.getByRole('tabpanel', { name: '1st Team' }));
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
