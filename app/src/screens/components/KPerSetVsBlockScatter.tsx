import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { analytics } from '@vcd/shared';

export type KPerSetVsBlockScatterProps = {
  data: analytics.KPerSetVsBlockData;
  homeColor?: string;
  awayColor?: string;
  homeLabel?: string;
  awayLabel?: string;
};

export function KPerSetVsBlockScatter(props: KPerSetVsBlockScatterProps) {
  const homeColor = props.homeColor ?? '#ff6b2c';
  const awayColor = props.awayColor ?? '#3aa9ff';
  const homeLabel = props.homeLabel ?? 'Home';
  const awayLabel = props.awayLabel ?? 'Away';
  const homePoints = props.data.filter((p) => p.isHome);
  const awayPoints = props.data.filter((p) => !p.isHome);

  return (
    <figure className="analytics__chart" aria-label="Kills per set vs opponent block rating">
      <figcaption>K/Set vs Opponent Block Rating</figcaption>
      <div data-testid="chart-scatter" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="opponentBlockAvg"
              name="Opp block"
              domain={['dataMin - 5', 'dataMax + 5']}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <YAxis
              type="number"
              dataKey="killsPerSet"
              name="K/set"
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <ZAxis type="number" dataKey="kills" range={[40, 200]} name="kills" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name) => [
                typeof value === 'number' ? value.toFixed(2) : String(value ?? ''),
                String(name ?? ''),
              ]}
            />
            <Legend />
            <Scatter name={homeLabel} data={homePoints} fill={homeColor} />
            <Scatter name={awayLabel} data={awayPoints} fill={awayColor} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <table className="visually-hidden">
        <caption>K/set vs opponent block rating (data table)</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Team</th>
            <th scope="col">Position</th>
            <th scope="col">K/set</th>
            <th scope="col">Opp block avg</th>
            <th scope="col">Kills</th>
          </tr>
        </thead>
        <tbody>
          {props.data.map((p) => (
            <tr key={p.playerId}>
              <th scope="row">{p.playerName}</th>
              <td>{p.isHome ? homeLabel : awayLabel}</td>
              <td>{p.position}</td>
              <td>{p.killsPerSet.toFixed(2)}</td>
              <td>{p.opponentBlockAvg.toFixed(0)}</td>
              <td>{p.kills}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
