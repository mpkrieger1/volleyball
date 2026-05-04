// Sprint 28 redesign: AVCA All-Americans screen with ShadCN-style primitives.
//
// Layout:
//   - Header: title + sub.
//   - Stats strip (.recruiting-header) with season picker, tier counts.
//   - Position filter row (.ui-checkbox toggles).
//   - Tab nav (.recruiting-board__tabs) for First / Second / Third / HM.
//   - Table (.ui-table) of selections; click a player name to expand
//     career AA history inline.

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

  const tierCounts: Record<AaTeam, number> = {
    first: teams.first.length,
    second: teams.second.length,
    third: teams.third.length,
    hm: teams.hm.length,
  };
  const totalSelections =
    tierCounts.first + tierCounts.second + tierCounts.third + tierCounts.hm;

  return (
    <section aria-labelledby="awards-heading" className="awards-view">
      <header className="match-hub__header">
        <h1 id="awards-heading">AVCA All-Americans</h1>
        <p className="match-hub__sub">
          Annual selections by tier — click a player to expand career AA history.
        </p>
      </header>

      <section
        className="recruiting-header"
        aria-label="Awards summary"
        data-testid="awards-header"
      >
        <div className="recruiting-header__cap recruiting-header__cap--field">
          <span className="recruiting-header__cap-label">Season</span>
          <select
            id="awards-season"
            className="ui-select"
            value={seasonYear ?? ''}
            onChange={(e) => void onSelectSeason(Number(e.target.value))}
            aria-label="Select season"
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
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Total selections</span>
          <span className="recruiting-header__cap-value">{totalSelections}</span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">1st Team</span>
          <span className="recruiting-header__cap-value">{tierCounts.first}</span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">2nd Team</span>
          <span className="recruiting-header__cap-value">{tierCounts.second}</span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">3rd Team</span>
          <span className="recruiting-header__cap-value">{tierCounts.third}</span>
        </div>
        <div className="recruiting-header__cap">
          <span className="recruiting-header__cap-label">Honorable Mention</span>
          <span className="recruiting-header__cap-value">{tierCounts.hm}</span>
        </div>
      </section>

      <fieldset
        className="awards-view__pos-filter recruiting-board__toolbar-filters"
        aria-label="Position filter"
      >
        <legend className="ui-label">Positions</legend>
        {POSITIONS.map((p) => {
          const checked = posFilter.has(p);
          return (
            <label
              key={p}
              className={
                checked
                  ? 'ui-toggle-pill ui-toggle-pill--active'
                  : 'ui-toggle-pill'
              }
              data-testid={`awards-pos-${p}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePos(p)}
                className="visually-hidden"
              />
              {p}
            </label>
          );
        })}
      </fieldset>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {status === 'loading' && <p data-testid="awards-loading">Loading…</p>}

      {status === 'ready' && seasonYear != null && (
        <>
          <nav
            aria-label="AA team selection"
            className="recruiting-board__tabs"
            role="tablist"
          >
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
                className={
                  activeTeam === t
                    ? 'recruiting-board__tab recruiting-board__tab--active'
                    : 'recruiting-board__tab'
                }
                data-testid={`awards-tab-${t}`}
              >
                {TEAM_LABELS[t]}
                <span
                  aria-hidden="true"
                  className="ui-badge ui-badge--muted awards-view__tab-count"
                >
                  {tierCounts[t]}
                </span>
              </button>
            ))}
          </nav>
          <div
            role="tabpanel"
            id={`awards-panel-${activeTeam}`}
            aria-labelledby={`awards-tab-${activeTeam}`}
          >
            <div className="ui-table-wrap">
              <table
                className="ui-table awards-view__table"
                data-testid="awards-table"
              >
                <caption className="visually-hidden">
                  {TEAM_LABELS[activeTeam]} — {seasonYear} season
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="t-num">#</th>
                    <th scope="col">Player</th>
                    <th scope="col" className="t-num">Pos</th>
                    <th scope="col">School</th>
                    <th scope="col" className="t-num">Class</th>
                    <th scope="col">Stat</th>
                    <th scope="col" className="t-num">Prior AA</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="awards-view__empty">
                        No selections matching the current filter.
                      </td>
                    </tr>
                  )}
                  {visibleEntries.map((e, idx) => {
                    const expanded = expandedPlayerId === e.playerId;
                    const detailId = `awards-career-${e.playerId}`;
                    return (
                      <Fragment key={e.playerId}>
                        <tr className="awards-view__row">
                          <td className="t-num">{idx + 1}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void onTogglePlayer(e.playerId)}
                              aria-expanded={expanded}
                              aria-controls={detailId}
                              className="awards-view__player-btn"
                            >
                              <strong>{e.playerName}</strong>
                              <span aria-hidden="true" className="awards-view__chevron">
                                {expanded ? '▾' : '▸'}
                              </span>
                            </button>
                          </td>
                          <td className="t-num">
                            {effectivePosition(e.position, e.isLibero)}
                          </td>
                          <td>{e.teamName}</td>
                          <td className="t-num">{e.classYear}</td>
                          <td>
                            <span className="awards-view__stat">
                              <strong>{e.primaryStat.value}</strong>{' '}
                              <span className="awards-view__stat-label">
                                {e.primaryStat.label}
                              </span>
                            </span>
                          </td>
                          <td className="t-num">
                            {e.priorAaCount > 0 ? (
                              <span className="ui-badge ui-badge--accent">
                                {e.priorAaCount}×
                              </span>
                            ) : (
                              <span className="ui-badge ui-badge--muted">—</span>
                            )}
                          </td>
                        </tr>
                        {expanded && careerByPlayerId[e.playerId] && (
                          <tr>
                            <td colSpan={7} id={detailId} className="awards-view__career">
                              <h3 className="awards-view__career-heading">
                                Career AA history:
                              </h3>
                              {careerByPlayerId[e.playerId]!.length === 0 ? (
                                <p className="awards-view__empty">
                                  No prior or current AA awards.
                                </p>
                              ) : (
                                <ul className="awards-view__career-list">
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
          </div>
        </>
      )}

      {status === 'error' && availableSeasons.length === 0 && (
        <p className="match-hub__sub">
          No AA awards yet — finish a season through the NCAA championship.
        </p>
      )}
    </section>
  );
}
