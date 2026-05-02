import { Fragment, useEffect, useState } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useAwardsStore, type AaTeam } from '../store/useAwardsStore';

const TEAM_LABELS: Record<AaTeam, string> = {
  first: '1st Team',
  second: '2nd Team',
  third: '3rd Team',
  hm: 'Honorable Mention',
};
const TEAMS: AaTeam[] = ['first', 'second', 'third', 'hm'];
const POSITIONS = ['OH', 'MB', 'OPP', 'S', 'L'] as const;
type Position = (typeof POSITIONS)[number];

function effectivePosition(pos: string, isLibero: boolean): string {
  return isLibero ? 'L' : pos;
}

export function AwardsView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const {
    status,
    error,
    seasonYear,
    availableSeasons,
    teams,
    careerByPlayerId,
    loadForSeason,
    loadCareer,
  } = useAwardsStore();
  const [activeTeam, setActiveTeam] = useState<AaTeam>('first');
  const [posFilter, setPosFilter] = useState<Set<Position>>(new Set(POSITIONS));
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!openedSlotId) return;
    if (seasonYear == null) {
      // First load: ask for the most recent season with awards. We do
      // this via a probe call; the handler returns availableSeasons.
      void loadForSeason(openedSlotId, new Date().getFullYear());
    }
  }, [openedSlotId, seasonYear, loadForSeason]);

  if (!openedSlotId) return null;

  function togglePos(p: Position): void {
    const next = new Set(posFilter);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPosFilter(next);
  }

  async function onSelectSeason(year: number): Promise<void> {
    if (!openedSlotId) return;
    await loadForSeason(openedSlotId, year);
    setExpandedPlayerId(null);
  }

  async function onTogglePlayer(playerId: string): Promise<void> {
    if (!openedSlotId) return;
    if (expandedPlayerId === playerId) {
      setExpandedPlayerId(null);
      return;
    }
    if (!careerByPlayerId[playerId]) await loadCareer(openedSlotId, playerId);
    setExpandedPlayerId(playerId);
  }

  const visibleEntries = teams[activeTeam].filter((e) =>
    posFilter.has(effectivePosition(e.position, e.isLibero) as Position),
  );

  return (
    <section aria-labelledby="awards-heading" className="awards-view">
      <header className="match-hub__header">
        <h1 id="awards-heading">AVCA All-Americans</h1>
        <div className="awards-view__controls">
          <label htmlFor="awards-season">
            Season:{' '}
            <select
              id="awards-season"
              value={seasonYear ?? ''}
              onChange={(e) => void onSelectSeason(Number(e.target.value))}
            >
              {availableSeasons.length === 0 && seasonYear == null && (
                <option value="">—</option>
              )}
              {availableSeasons.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="awards-view__pos-filter">
            <legend>Position filter</legend>
            {POSITIONS.map((p) => (
              <label key={p}>
                <input
                  type="checkbox"
                  checked={posFilter.has(p)}
                  onChange={() => togglePos(p)}
                />
                {p}
              </label>
            ))}
          </fieldset>
        </div>
      </header>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {status === 'loading' && <p>Loading…</p>}

      {status === 'ready' && seasonYear != null && (
        <>
          <nav aria-label="AA team selection" className="awards-view__tabs" role="tablist">
            {TEAMS.map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={activeTeam === t}
                aria-controls={`awards-panel-${t}`}
                id={`awards-tab-${t}`}
                onClick={() => {
                  setActiveTeam(t);
                  setExpandedPlayerId(null);
                }}
                className={activeTeam === t ? 'awards-view__tab--active' : ''}
              >
                {TEAM_LABELS[t]}
              </button>
            ))}
          </nav>
          <div
            role="tabpanel"
            id={`awards-panel-${activeTeam}`}
            aria-labelledby={`awards-tab-${activeTeam}`}
          >
            <table className="poll-view__table awards-view__table">
              <caption>
                {TEAM_LABELS[activeTeam]} — {seasonYear} season
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col">Pos</th>
                  <th scope="col">School</th>
                  <th scope="col">Class</th>
                  <th scope="col">Stat</th>
                  <th scope="col">Prior AA</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e, idx) => {
                  const expanded = expandedPlayerId === e.playerId;
                  const detailId = `awards-career-${e.playerId}`;
                  return (
                    <Fragment key={e.playerId}>
                      <tr className="awards-view__row">
                        <td>{idx + 1}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => void onTogglePlayer(e.playerId)}
                            aria-expanded={expanded}
                            aria-controls={detailId}
                            className="awards-view__player-btn"
                          >
                            {e.playerName}
                          </button>
                        </td>
                        <td>{effectivePosition(e.position, e.isLibero)}</td>
                        <td>{e.teamName}</td>
                        <td>{e.classYear}</td>
                        <td>
                          {e.primaryStat.value} {e.primaryStat.label}
                        </td>
                        <td>{e.priorAaCount}</td>
                      </tr>
                      {expanded && careerByPlayerId[e.playerId] && (
                        <tr>
                          <td colSpan={7} id={detailId}>
                            <strong>Career AA history:</strong>
                            {careerByPlayerId[e.playerId]!.length === 0 ? (
                              <p>No prior or current AA awards.</p>
                            ) : (
                              <ul>
                                {careerByPlayerId[e.playerId]!.map((c) => (
                                  <li key={`${c.seasonYear}-${c.team}`}>
                                    {c.seasonYear} — {TEAM_LABELS[c.team]}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status === 'error' && availableSeasons.length === 0 && (
        <p>No AA awards yet — finish a season through the NCAA championship.</p>
      )}
    </section>
  );
}
