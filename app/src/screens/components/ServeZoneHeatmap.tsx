import { useState } from 'react';
import type { analytics } from '@vcd/shared';

export type ServeZoneHeatmapProps = {
  data: analytics.ServeZoneHeatmapData;
  homeLabel?: string;
  awayLabel?: string;
};

// Court layout: 3 columns × 2 rows. Front row (closest to net) = zones 4, 3, 2.
// Back row = zones 5, 6, 1. Volleyball-conventional numbering.
const COURT_GRID: { row: number; col: number; zone: 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { row: 0, col: 0, zone: 4, label: 'Z4' },
  { row: 0, col: 1, zone: 3, label: 'Z3' },
  { row: 0, col: 2, zone: 2, label: 'Z2' },
  { row: 1, col: 0, zone: 5, label: 'Z5' },
  { row: 1, col: 1, zone: 6, label: 'Z6' },
  { row: 1, col: 2, zone: 1, label: 'Z1' },
];

export function ServeZoneHeatmap(props: ServeZoneHeatmapProps) {
  const [side, setSide] = useState<'home' | 'away'>('home');
  const homeLabel = props.homeLabel ?? 'Home';
  const awayLabel = props.awayLabel ?? 'Away';
  const cells = props.data.filter((c) => c.servingTeam === side);
  const courtCells = cells.filter((c) => c.zone !== 0);
  const acePile = cells.find((c) => c.zone === 0);

  const maxCount = Math.max(1, ...courtCells.map((c) => c.count));

  return (
    <figure className="analytics__chart" aria-label="Serve location heat map">
      <figcaption>Serve Heat Map</figcaption>
      <div className="analytics__heatmap-controls" role="radiogroup" aria-label="Serving team">
        <label>
          <input
            type="radio"
            name="serve-heatmap-side"
            value="home"
            checked={side === 'home'}
            onChange={() => setSide('home')}
          />
          {homeLabel}
        </label>
        <label>
          <input
            type="radio"
            name="serve-heatmap-side"
            value="away"
            checked={side === 'away'}
            onChange={() => setSide('away')}
          />
          {awayLabel}
        </label>
      </div>
      <div data-testid="chart-heatmap" className="analytics__heatmap-grid">
        {COURT_GRID.map((slot) => {
          const cell = courtCells.find((c) => c.zone === slot.zone);
          const count = cell?.count ?? 0;
          const intensity = count / maxCount;
          const bg = `rgba(255, 107, 44, ${intensity * 0.85 + 0.05})`;
          return (
            <div
              key={slot.zone}
              className="analytics__heatmap-cell"
              style={{
                gridRow: slot.row + 1,
                gridColumn: slot.col + 1,
                backgroundColor: bg,
              }}
              role="img"
              aria-label={`Zone ${slot.zone}: ${count} serves`}
            >
              <span className="analytics__heatmap-label">{slot.label}</span>
              <span className="analytics__heatmap-count">{count}</span>
            </div>
          );
        })}
      </div>
      <p className="analytics__heatmap-pile">
        Aces: {acePile?.aces ?? 0} · Service errors: {acePile?.errors ?? 0}
      </p>
      <table className="visually-hidden">
        <caption>Serve zone counts ({side === 'home' ? homeLabel : awayLabel} serving)</caption>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">Count</th>
            <th scope="col">Aces</th>
            <th scope="col">Errors</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((c) => (
            <tr key={c.zone}>
              <th scope="row">Z{c.zone}</th>
              <td>{c.count}</td>
              <td>{c.aces}</td>
              <td>{c.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
