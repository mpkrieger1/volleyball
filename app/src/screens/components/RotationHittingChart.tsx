import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { analytics } from '@vcd/shared';

export type RotationHittingChartProps = {
  data: analytics.RotationHittingPctData;
  homeColor?: string;
  awayColor?: string;
  homeLabel?: string;
  awayLabel?: string;
};

export function RotationHittingChart(props: RotationHittingChartProps) {
  const homeColor = props.homeColor ?? '#ff6b2c';
  const awayColor = props.awayColor ?? '#3aa9ff';
  const homeLabel = props.homeLabel ?? 'Home';
  const awayLabel = props.awayLabel ?? 'Away';

  const chartData = [0, 1, 2, 3, 4, 5].map((rotIdx) => ({
    rotation: `R${rotIdx + 1}`,
    home: (props.data.home[rotIdx] ?? 0) / 1000,
    away: (props.data.away[rotIdx] ?? 0) / 1000,
    homeKills: props.data.homeCounts[rotIdx]?.kills ?? 0,
    awayKills: props.data.awayCounts[rotIdx]?.kills ?? 0,
  }));

  return (
    <figure className="analytics__chart" aria-label="Hitting percentage by rotation">
      <figcaption>Hitting % by Rotation</figcaption>
      <div data-testid="chart-rotation" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rotation" />
            <YAxis tickFormatter={(v: number) => v.toFixed(2)} domain={[-0.3, 0.6]} />
            <Tooltip
              formatter={(value) =>
                typeof value === 'number' ? value.toFixed(3) : String(value ?? '')
              }
            />
            <Legend />
            <Bar dataKey="home" name={homeLabel} fill={homeColor} />
            <Bar dataKey="away" name={awayLabel} fill={awayColor} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="visually-hidden">
        <caption>Hitting % by rotation (data table)</caption>
        <thead>
          <tr>
            <th scope="col">Rotation</th>
            <th scope="col">{homeLabel} hitting%</th>
            <th scope="col">{awayLabel} hitting%</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row) => (
            <tr key={row.rotation}>
              <th scope="row">{row.rotation}</th>
              <td>{row.home.toFixed(3)}</td>
              <td>{row.away.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
