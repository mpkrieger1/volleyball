import { useMemo } from 'react';
import { usePostseasonStore } from '../store/usePostseasonStore';

const ROUND_ORDER = [
  'NCAA_R64',
  'NCAA_R32',
  'NCAA_S16',
  'NCAA_E8',
  'NCAA_FF',
  'NCAA_CHAMP',
] as const;
const ROUND_LABELS: Record<string, string> = {
  NCAA_R64: 'R64',
  NCAA_R32: 'R32',
  NCAA_S16: 'Sweet 16',
  NCAA_E8: 'Elite 8',
  NCAA_FF: 'Final Four',
  NCAA_CHAMP: 'Championship',
};

export function ChampionCrown() {
  const {
    seasonYear,
    championTeamId,
    championTeamSchool,
    matches,
    setView,
  } = usePostseasonStore();

  const path = useMemo(() => {
    if (!championTeamId) return [];
    const byRound = new Map<string, typeof matches[number]>();
    for (const m of matches) {
      if (m.homeTeamId === championTeamId || m.awayTeamId === championTeamId) {
        if (ROUND_ORDER.includes(m.round as typeof ROUND_ORDER[number])) {
          byRound.set(m.round, m);
        }
      }
    }
    return ROUND_ORDER
      .map((r) => byRound.get(r))
      .filter(<T,>(x: T | undefined): x is T => !!x);
  }, [championTeamId, matches]);

  const finalGame = matches.find((m) => m.round === 'NCAA_CHAMP');

  if (!championTeamId) {
    return (
      <section aria-labelledby="crown-heading" className="champion-crown">
        <h1 id="crown-heading">National Champion</h1>
        <p>No champion crowned yet.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="crown-heading" className="champion-crown">
      <header className="match-hub__header">
        <h1 id="crown-heading">
          {championTeamSchool ?? '(unknown team)'} — {seasonYear} National Champions
        </h1>
        <p className="match-hub__sub">NCAA Division I Women&apos;s Volleyball</p>
      </header>

      <div className="champion-crown__controls">
        <button type="button" onClick={() => setView('ncaa')} className="app-nav__btn">
          Back to bracket
        </button>
      </div>

      {finalGame && (
        <section aria-label="Final game" className="champion-crown__final">
          <h2>Title Game</h2>
          <p>
            {finalGame.homeTeamSchool} vs {finalGame.awayTeamSchool}
            {finalGame.setScores.length > 0 && (
              <>
                {' '}
                — {finalGame.setScores.map((s) => `${s.home}-${s.away}`).join(', ')}
              </>
            )}
          </p>
        </section>
      )}

      <section aria-label="Path to the title" className="champion-crown__path">
        <h2>Path to the title</h2>
        <table className="poll-view__table">
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">Opponent</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {path.map((m) => {
              const oppAbbr =
                m.homeTeamId === championTeamId ? m.awayTeamAbbr : m.homeTeamAbbr;
              const oppSchool =
                m.homeTeamId === championTeamId ? m.awayTeamSchool : m.homeTeamSchool;
              const score =
                m.setScores.length > 0
                  ? m.setScores.map((s) => `${s.home}-${s.away}`).join(', ')
                  : '';
              return (
                <tr key={m.matchId}>
                  <td>{ROUND_LABELS[m.round] ?? m.round}</td>
                  <td>
                    <span className="poll-view__abbr">{oppAbbr}</span>{' '}
                    <span className="poll-view__school">{oppSchool}</span>
                  </td>
                  <td>{score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </section>
  );
}
