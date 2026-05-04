import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useAnalyticsStore, type AnalyticsMode } from '../store/useAnalyticsStore';
import { useUserTeamStore } from '../store/useUserTeamStore';
import { RotationHittingChart } from './components/RotationHittingChart';
import { KPerSetVsBlockScatter } from './components/KPerSetVsBlockScatter';
import { ReceptionGradeHistogram } from './components/ReceptionGradeHistogram';
import { ServeZoneHeatmap } from './components/ServeZoneHeatmap';
import { RallyLengthDistribution } from './components/RallyLengthDistribution';
import { SeasonAnalyticsPanel } from './components/SeasonAnalyticsPanel';

function fmtMatchOption(m: { homeAbbr: string; awayAbbr: string; homeSetsWon: number; awaySetsWon: number; week: number; date: string }): string {
  return `${m.homeAbbr} ${m.homeSetsWon}-${m.awaySetsWon} ${m.awayAbbr} (W${m.week})`;
}

const MODES: Array<{ id: AnalyticsMode; label: string }> = [
  { id: 'match', label: 'Match-by-match' },
  { id: 'season', label: 'Season totals' },
];

export function AnalyticsView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const userTeamId = useUserTeamStore((s) => s.userTeamId);
  const {
    phase,
    mode,
    matches,
    selectedMatchId,
    data,
    charts,
    season,
    error,
    loadMatches,
    selectMatch,
    setMode,
    loadSeason,
  } = useAnalyticsStore();

  useEffect(() => {
    if (!openedSlotId) return;
    if (mode === 'match' && matches.length === 0 && phase === 'idle') {
      void loadMatches(openedSlotId);
    }
    if (mode === 'season' && userTeamId && season === null && phase !== 'loading-season') {
      void loadSeason(openedSlotId, userTeamId);
    }
  }, [
    openedSlotId,
    mode,
    matches.length,
    phase,
    userTeamId,
    season,
    loadMatches,
    loadSeason,
  ]);

  if (!openedSlotId) return null;

  return (
    <section aria-labelledby="analytics-heading" className="analytics-view">
      <header className="match-hub__header">
        <h1 id="analytics-heading">Analytics</h1>
        <p className="match-hub__sub">
          {mode === 'match'
            ? 'Per-match charts derived from box score + PBP.'
            : 'Season totals and trends for your team.'}
        </p>
      </header>

      <nav
        className="recruiting-board__tabs"
        role="tablist"
        aria-label="Analytics view mode"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={
              mode === m.id
                ? 'recruiting-board__tab recruiting-board__tab--active'
                : 'recruiting-board__tab'
            }
            data-testid={`analytics-mode-${m.id}`}
          >
            {m.label}
          </button>
        ))}
      </nav>

      {mode === 'match' && (
        <div className="analytics__controls" role="group" aria-label="Match selection">
          <div className="ui-field">
            <label htmlFor="analytics-match" className="ui-label">Match</label>
            <select
              id="analytics-match"
              className="ui-select"
              value={selectedMatchId ?? ''}
              onChange={(e) => {
                if (openedSlotId) void selectMatch(openedSlotId, e.target.value);
              }}
              disabled={matches.length === 0}
            >
              {matches.length === 0 && <option value="">No played matches yet…</option>}
              {matches.map((m) => (
                <option key={m.matchId} value={m.matchId}>
                  {fmtMatchOption(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {phase === 'loading-matches' && <p>Loading matches…</p>}
      {phase === 'loading-analytics' && <p>Loading analytics…</p>}
      {phase === 'loading-season' && <p data-testid="analytics-loading-season">Loading season totals…</p>}

      {mode === 'match' && phase === 'ready' && data && charts && (
        <div className="analytics__chart-grid">
          <RotationHittingChart
            data={charts.rotation}
            homeColor={data.home.primaryColor}
            awayColor={data.away.primaryColor}
            homeLabel={data.home.teamAbbr}
            awayLabel={data.away.teamAbbr}
          />
          <KPerSetVsBlockScatter
            data={charts.scatter}
            homeColor={data.home.primaryColor}
            awayColor={data.away.primaryColor}
            homeLabel={data.home.teamAbbr}
            awayLabel={data.away.teamAbbr}
          />
          <ReceptionGradeHistogram data={charts.histogram} />
          <ServeZoneHeatmap
            data={charts.heatmap}
            homeLabel={data.home.teamAbbr}
            awayLabel={data.away.teamAbbr}
          />
          <RallyLengthDistribution
            data={charts.rallyLength}
            homeColor={data.home.primaryColor}
            awayColor={data.away.primaryColor}
            homeLabel={data.home.teamAbbr}
            awayLabel={data.away.teamAbbr}
          />
        </div>
      )}

      {mode === 'season' && phase === 'ready' && season && (
        <SeasonAnalyticsPanel season={season} />
      )}
      {mode === 'season' && !userTeamId && (
        <p className="match-hub__sub">Pick your team from the Hub to see season totals.</p>
      )}
    </section>
  );
}
