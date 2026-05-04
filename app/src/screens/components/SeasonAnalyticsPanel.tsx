// Sprint 28: season-aggregate analytics panel.
//
// Renders three sections:
//   - Team summary tile row (record, sets, hitting %, opp hitting %, totals)
//   - Per-match trend table (sortable; serves as a poor-mans line chart for now)
//   - Per-player season totals leaderboard
//
// Reuses ShadCN-style table primitives (.ui-table, .ui-badge).

import type { matchIpc } from '@vcd/shared';

type Props = {
  season: Extract<matchIpc.SeasonAnalyticsResponse, { ok: true }>;
};

function fmtPct(milli: number): string {
  const v = milli / 1000;
  const sign = v >= 0 ? '' : '-';
  const abs = Math.abs(milli);
  return `${sign}.${String(Math.round(abs)).padStart(3, '0')}`;
}

function fmtPerSet(milli: number): string {
  return (milli / 1000).toFixed(2);
}

export function SeasonAnalyticsPanel({ season }: Props) {
  const t = season.team;
  return (
    <div className="season-analytics" data-testid="season-analytics-panel">
      <section
        aria-label="Team season summary"
        className="season-analytics__summary"
      >
        <SummaryCard label="Record" value={`${t.wins}-${t.losses}`} />
        <SummaryCard label="Sets" value={`${t.setsWon}-${t.setsLost}`} />
        <SummaryCard
          label="Hitting %"
          value={fmtPct(t.teamHittingPctMilli)}
        />
        <SummaryCard
          label="Opp hitting %"
          value={fmtPct(t.oppHittingPctMilli)}
        />
        <SummaryCard label="Kills" value={t.totalKills.toLocaleString()} />
        <SummaryCard label="Aces" value={t.totalAces.toLocaleString()} />
        <SummaryCard label="Blocks" value={t.totalBlocks.toLocaleString()} />
        <SummaryCard label="Digs" value={t.totalDigs.toLocaleString()} />
      </section>

      <section
        aria-labelledby="season-trend-heading"
        className="season-analytics__section"
      >
        <h2 id="season-trend-heading" className="season-analytics__h2">
          Match-by-match trend
        </h2>
        {season.trend.length === 0 ? (
          <p className="season-analytics__empty">No matches played yet.</p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table" data-testid="season-trend-table">
              <caption className="visually-hidden">Per-match trend</caption>
              <thead>
                <tr>
                  <th scope="col" className="t-num">Wk</th>
                  <th scope="col">Date</th>
                  <th scope="col">Opp</th>
                  <th scope="col" className="t-num">Sets</th>
                  <th scope="col" className="t-num">Result</th>
                  <th scope="col" className="t-num">Hit %</th>
                  <th scope="col" className="t-num">Opp Hit %</th>
                  <th scope="col" className="t-num">K</th>
                  <th scope="col" className="t-num">Opp K</th>
                </tr>
              </thead>
              <tbody>
                {season.trend.map((m) => {
                  const won = m.setsWon > m.setsLost;
                  return (
                    <tr key={m.matchId}>
                      <td className="t-num">{m.weekIndex}</td>
                      <td>{m.isoDate}</td>
                      <td>
                        {m.isHome ? 'vs ' : 'at '}
                        {m.opponentAbbr}
                      </td>
                      <td className="t-num">
                        {m.setsWon}-{m.setsLost}
                      </td>
                      <td className="t-num">
                        <span
                          className={
                            won ? 'ui-badge ui-badge--success' : 'ui-badge ui-badge--danger'
                          }
                        >
                          {won ? 'W' : 'L'}
                        </span>
                      </td>
                      <td className="t-num">{fmtPct(m.hittingPctMilli)}</td>
                      <td className="t-num">{fmtPct(m.oppHittingPctMilli)}</td>
                      <td className="t-num">{m.kills}</td>
                      <td className="t-num">{m.oppKills}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="season-leaders-heading"
        className="season-analytics__section"
      >
        <h2 id="season-leaders-heading" className="season-analytics__h2">
          Player season totals
        </h2>
        {season.players.length === 0 ? (
          <p className="season-analytics__empty">No player stats yet.</p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table" data-testid="season-players-table">
              <caption className="visually-hidden">Player season totals</caption>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col" className="t-num">Pos</th>
                  <th scope="col" className="t-num">M</th>
                  <th scope="col" className="t-num">Sets</th>
                  <th scope="col" className="t-num">K</th>
                  <th scope="col" className="t-num">K/S</th>
                  <th scope="col" className="t-num">E</th>
                  <th scope="col" className="t-num">TA</th>
                  <th scope="col" className="t-num">Pct</th>
                  <th scope="col" className="t-num">D</th>
                  <th scope="col" className="t-num">B</th>
                  <th scope="col" className="t-num">A</th>
                  <th scope="col" className="t-num">As</th>
                </tr>
              </thead>
              <tbody>
                {season.players.map((p) => (
                  <tr key={p.playerId}>
                    <td>{p.playerName}</td>
                    <td className="t-num">{p.position}</td>
                    <td className="t-num">{p.matchesPlayed}</td>
                    <td className="t-num">{p.setsPlayed}</td>
                    <td className="t-num">{p.kills}</td>
                    <td className="t-num">{fmtPerSet(p.killsPerSetMilli)}</td>
                    <td className="t-num">{p.errors}</td>
                    <td className="t-num">{p.totalAttacks}</td>
                    <td className="t-num">{fmtPct(p.hittingPctMilli)}</td>
                    <td className="t-num">{p.digs}</td>
                    <td className="t-num">{p.blocks}</td>
                    <td className="t-num">{p.aces}</td>
                    <td className="t-num">{p.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="season-analytics__card">
      <span className="season-analytics__card-label">{label}</span>
      <span className="season-analytics__card-value">{value}</span>
    </article>
  );
}
