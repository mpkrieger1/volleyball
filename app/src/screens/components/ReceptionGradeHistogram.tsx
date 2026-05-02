import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { analytics } from '@vcd/shared';

export type ReceptionGradeHistogramProps = {
  data: analytics.ReceptionGradeHistogramData;
};

const GRADE_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: '#c62828',
  1: '#f9a825',
  2: '#43a047',
  3: '#1e88e5',
};

export function ReceptionGradeHistogram(props: ReceptionGradeHistogramProps) {
  const chartData = props.data.map((row) => ({
    name: row.playerName,
    grade0: row.grade0,
    grade1: row.grade1,
    grade2: row.grade2,
    grade3: row.grade3,
  }));

  return (
    <figure className="analytics__chart" aria-label="Reception grade distribution per player">
      <figcaption>Reception Grades</figcaption>
      <div data-testid="chart-histogram" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={70} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="grade0" name="0 (error)" stackId="g" fill={GRADE_COLORS[0]} />
            <Bar dataKey="grade1" name="1 (poor)" stackId="g" fill={GRADE_COLORS[1]} />
            <Bar dataKey="grade2" name="2 (good)" stackId="g" fill={GRADE_COLORS[2]} />
            <Bar dataKey="grade3" name="3 (perfect)" stackId="g" fill={GRADE_COLORS[3]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="visually-hidden">
        <caption>Reception grades per player (data table)</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Grade 0 (error)</th>
            <th scope="col">Grade 1</th>
            <th scope="col">Grade 2</th>
            <th scope="col">Grade 3 (perfect)</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {props.data.map((row) => (
            <tr key={row.playerId}>
              <th scope="row">{row.playerName}</th>
              <td>{row.grade0}</td>
              <td>{row.grade1}</td>
              <td>{row.grade2}</td>
              <td>{row.grade3}</td>
              <td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
