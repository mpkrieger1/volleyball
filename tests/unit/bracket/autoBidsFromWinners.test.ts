import { describe, it, expect } from 'vitest';
import { bracket } from '@vcd/shared';

describe('autoBidsFromTournamentWinners', () => {
  it('returns one auto-bid per conference based on the CT final winner', () => {
    const finals: bracket.CtFinalMatch[] = [
      { homeTeamId: 'A', awayTeamId: 'B', winnerId: 'A', bracketGroupKey: 'C1' },
      { homeTeamId: 'C', awayTeamId: 'D', winnerId: 'D', bracketGroupKey: 'C2' },
    ];
    const bids = bracket.autoBidsFromTournamentWinners(finals);
    expect(bids).toEqual([
      { teamId: 'A', conferenceId: 'C1' },
      { teamId: 'D', conferenceId: 'C2' },
    ]);
  });

  it('dedupes if the same conference somehow appears twice', () => {
    const finals: bracket.CtFinalMatch[] = [
      { homeTeamId: 'A', awayTeamId: 'B', winnerId: 'A', bracketGroupKey: 'C1' },
      { homeTeamId: 'A', awayTeamId: 'B', winnerId: 'B', bracketGroupKey: 'C1' },
    ];
    expect(bracket.autoBidsFromTournamentWinners(finals)).toHaveLength(1);
  });

  it('empty input → empty output', () => {
    expect(bracket.autoBidsFromTournamentWinners([])).toEqual([]);
  });
});
