import { describe, expect, it } from 'vitest';
import { parseBenchmarkCsv, benchmarkTop25Averages } from '@vcd/shared/calibration';

const REAL_CSV = `teamRank,schoolName,hittingPct,killsPerSet,liberoDigsPerSet,blocksPerSet,assistsPerSet
1,Pittsburgh,0.298,13.40,3.92,2.41,11.98
2,Penn State,0.285,12.91,3.81,2.55,11.65
3,Nebraska,0.270,13.10,4.00,2.30,12.20`;

const STUB_CSV = `# STUB - placeholder
# Source: TODO
teamRank,schoolName,hittingPct,killsPerSet,liberoDigsPerSet,blocksPerSet,assistsPerSet
1,EXAMPLE_TEAM,0.270,12.80,3.80,2.30,11.50`;

const MISSING_COL = `teamRank,schoolName,hittingPct,killsPerSet
1,Foo,0.270,12.80`;

const BAD_NUMERIC = `teamRank,schoolName,hittingPct,killsPerSet,liberoDigsPerSet,blocksPerSet,assistsPerSet
1,Foo,not-a-number,12.80,3.80,2.30,11.50`;

describe('parseBenchmarkCsv', () => {
  it('parses a real CSV into rows', () => {
    const result = parseBenchmarkCsv(REAL_CSV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stub).toBe(false);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({
      teamRank: 1,
      schoolName: 'Pittsburgh',
      hittingPct: 0.298,
      killsPerSet: 13.4,
      liberoDigsPerSet: 3.92,
      blocksPerSet: 2.41,
      assistsPerSet: 11.98,
    });
  });

  it('detects STUB marker and returns stub: true', () => {
    const result = parseBenchmarkCsv(STUB_CSV);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stub).toBe(true);
    expect(result.rows).toEqual([]);
  });

  it('rejects CSV with missing required column', () => {
    const result = parseBenchmarkCsv(MISSING_COL);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Missing required column/);
  });

  it('rejects rows with non-numeric values', () => {
    const result = parseBenchmarkCsv(BAD_NUMERIC);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/non-numeric/);
  });

  it('ignores blank lines and #-prefixed comments', () => {
    const csv = `# leading comment

teamRank,schoolName,hittingPct,killsPerSet,liberoDigsPerSet,blocksPerSet,assistsPerSet
1,Foo,0.270,12.80,3.80,2.30,11.50

2,Bar,0.250,11.50,3.20,2.10,10.50`;
    const result = parseBenchmarkCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok || result.stub) return;
    expect(result.rows).toHaveLength(2);
  });
});

describe('benchmarkTop25Averages', () => {
  it('computes mean across rows', () => {
    const result = parseBenchmarkCsv(REAL_CSV);
    if (!result.ok || result.stub) throw new Error('test fixture invalid');
    const avg = benchmarkTop25Averages(result.rows);
    // 0.298 + 0.285 + 0.270 = 0.853 / 3 = 0.2843
    expect(avg.hittingPct).toBeCloseTo(0.2843, 4);
  });

  it('returns zeros for empty input', () => {
    const avg = benchmarkTop25Averages([]);
    expect(avg.hittingPct).toBe(0);
    expect(avg.killsPerSet).toBe(0);
  });
});
