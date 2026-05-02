import { useEffect } from 'react';
import { useSaveSlotsStore } from '../store/useSaveSlotsStore';
import { useAnalyticsStore } from '../store/useAnalyticsStore';
import { RotationHittingChart } from './components/RotationHittingChart';
import { KPerSetVsBlockScatter } from './components/KPerSetVsBlockScatter';
import { ReceptionGradeHistogram } from './components/ReceptionGradeHistogram';
import { ServeZoneHeatmap } from './components/ServeZoneHeatmap';
import { RallyLengthDistribution } from './components/RallyLengthDistribution';

function fmtMatchOption(m: { homeAbbr: string; awayAbbr: string; homeSetsWon: number; awaySetsWon: number; week: number; date: string }): string {
  return `${m.homeAbbr} ${m.homeSetsWon}-${m.awaySetsWon} ${m.awayAbbr} (W${m.week})`;
}

export function AnalyticsView() {
  const openedSlotId = useSaveSlotsStore((s) => s.openedSlotId);
  const { phase, matches, selectedMatchId, data, charts, error } = useAnalyticsStore();
  const loadMatches = useAnalyticsStore((s) => s.loadMatches);
  const selectMatch = useAnalyticsStore((s) => s.selectMatch);

  useEffect(() => {
    if (openedSlotId && matches.length === 0 && phase === 'idle') {
      void loadMatches(openedSlotId);
    }
  }, [openedSlotId, matches.length, phase, loadMatches]);

  if (!openedSlotId) return null;

  return (
    <section aria-labelledby="analytics-heading" className="analytics-view">
      <header className="match-hub__header">
        <h1 id="analytics-heading">Analytics</h1>
        <p className="match-hub__sub">Per-match charts derived from box score + PBP.</p>
      </header>

      <div className="analytics__controls" role="group" aria-label="Match selection">
        <label htmlFor="analytics-match">
          Match:{' '}
          <select
            id="analytics-match"
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
        </label>
      </div>

      {error && (
        <p role="alert" className="match-hub__error">
          {error}
        </p>
      )}

      {phase === 'loading-matches' && <p>Loading matches…</p>}
      {phase === 'loading-analytics' && <p>Loading analytics…</p>}

      {phase === 'ready' && data && charts && (
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
    </section>
  );
}
