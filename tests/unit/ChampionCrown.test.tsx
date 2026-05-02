import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { ChampionCrown } from '../../app/src/screens/ChampionCrown';
import { usePostseasonStore } from '../../app/src/store/usePostseasonStore';
import { useSaveSlotsStore } from '../../app/src/store/useSaveSlotsStore';

beforeEach(() => {
  useSaveSlotsStore.setState({ slots: [], status: 'idle', error: null, openedSlotId: 'slot-1' });
});

describe('<ChampionCrown />', () => {
  it('renders champion headline + final game + path table', async () => {
    const champId = 'CHAMP';
    usePostseasonStore.setState({
      phase: 'OFFSEASON',
      seasonYear: 2026,
      championTeamId: champId,
      championTeamSchool: 'Test University',
      matches: [
        {
          matchId: 'r64',
          round: 'NCAA_R64',
          bracketSlot: 0,
          bracketGroupKey: 'REGION_1',
          homeTeamId: champId,
          awayTeamId: 'X',
          homeTeamAbbr: 'TU',
          awayTeamAbbr: 'XX',
          homeTeamSchool: 'Test University',
          awayTeamSchool: 'X U',
          winnerId: champId,
          setScores: [
            { home: 25, away: 23 },
            { home: 25, away: 20 },
            { home: 25, away: 18 },
          ],
        },
        {
          matchId: 'champ',
          round: 'NCAA_CHAMP',
          bracketSlot: 0,
          bracketGroupKey: 'NCAA',
          homeTeamId: champId,
          awayTeamId: 'FINALIST',
          homeTeamAbbr: 'TU',
          awayTeamAbbr: 'FF',
          homeTeamSchool: 'Test University',
          awayTeamSchool: 'Finalist College',
          winnerId: champId,
          setScores: [
            { home: 25, away: 21 },
            { home: 22, away: 25 },
            { home: 25, away: 20 },
            { home: 25, away: 23 },
          ],
        },
      ],
      status: 'ready',
      error: null,
      view: 'champion',
      selectedRegion: 'REGION_1',
      selectedConferenceId: null,
    });
    render(<ChampionCrown />);
    expect(
      screen.getByRole('heading', { name: /Test University — 2026 National Champions/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Finalist College/).length).toBeGreaterThan(0);
    // The path table has at least the R64 and CHAMP rows for the champion.
    expect(screen.getByText('R64')).toBeInTheDocument();
    expect(screen.getByText('Championship')).toBeInTheDocument();
  });

  it('axe-clean', async () => {
    usePostseasonStore.setState({
      phase: 'OFFSEASON',
      seasonYear: 2026,
      championTeamId: 'A',
      championTeamSchool: 'A U',
      matches: [],
      status: 'ready',
      error: null,
      view: 'champion',
      selectedRegion: 'REGION_1',
      selectedConferenceId: null,
    });
    const { container } = render(<ChampionCrown />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('no-champion state is handled', async () => {
    usePostseasonStore.setState({
      phase: 'NCAA',
      seasonYear: 2026,
      championTeamId: null,
      championTeamSchool: null,
      matches: [],
      status: 'ready',
      error: null,
      view: 'champion',
      selectedRegion: 'REGION_1',
      selectedConferenceId: null,
    });
    render(<ChampionCrown />);
    expect(screen.getByText(/No champion crowned yet/)).toBeInTheDocument();
  });
});
