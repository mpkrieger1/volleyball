import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { analytics } from '@vcd/shared';

export type RallyLengthDistributionProps = {
  data: analytics.RallyLengthData;
  homeColor?: string;
  awayColor?: string;
  homeLabel?: string;
  awayLabel?: string;
};

export function RallyLengthDistribution(props: RallyLengthDistributionProps) {
  const homeColor = props.homeColor ?? '#ff6b2c';
  const awayColor = props.awayColor ?? '#3aa9ff';
  const homeLabel = props.homeLabel ?? 'Home';
  const awayLabel = props.awayLabel ?? 'Away';

  const chartData = props.data.map((row) => ({
    bucket: row.bucket,
    home: row.homePoints,
    away: row.awayPoints,
    total: row.count,
  }));

  return (
    <figure className="analytics__chart" aria-label="Rally length distribution and point differential">
      <figcaption>Rally Length Distribution</figcaption>
      <div data-testid="chart-rally-length" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="home" name={`${homeLabel} pts`} stackId="pts" fill={homeColor} />
            <Bar dataKey="away" name={`${awayLabel} pts`} stackId="pts" fill={awayColor} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="visually-hidden">
        <caption>Rally lengths and point distribution (data table)</caption>
        <thead>
          <tr>
            <th scope="col">Bucket (events)</th>
            <th scope="col">Total rallies</th>
            <th scope="col">{homeLabel} points</th>
            <th scope="col">{awayLabel} points</th>
          </tr>
        </thead>
        <tbody>
          {props.data.map((row) => (
            <tr key={row.bucket}>
              <th scope="row">{row.bucket}</th>
              <td>{row.count}</td>
              <td>{row.homePoints}</td>
              <td>{row.awayPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
