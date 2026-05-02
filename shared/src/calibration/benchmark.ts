// Sprint 22: parser for the NCAA top-25 benchmark CSV used by the
// calibration test suite. Pure / no I/O — tests + main + scripts pass
// `text` after reading the file from disk.
//
// Stub detection: if any comment line (starts with `#`) contains the
// literal `STUB` token, the file is treated as a placeholder and the
// calibration assertions are skipped (with a warning logged).

export type BenchmarkRow = {
  teamRank: number;
  schoolName: string;
  hittingPct: number;
  killsPerSet: number;
  liberoDigsPerSet: number;
  blocksPerSet: number;
  assistsPerSet: number;
};

export type BenchmarkLoadResult =
  | { ok: true; stub: false; rows: BenchmarkRow[] }
  | { ok: true; stub: true; rows: [] }
  | { ok: false; error: string };

const REQUIRED_COLUMNS = [
  'teamRank',
  'schoolName',
  'hittingPct',
  'killsPerSet',
  'liberoDigsPerSet',
  'blocksPerSet',
  'assistsPerSet',
] as const;

export function parseBenchmarkCsv(text: string): BenchmarkLoadResult {
  const allLines = text.split(/\r?\n/);
  const commentLines = allLines.filter((l) => l.trimStart().startsWith('#'));
  const isStub = commentLines.some((l) => l.includes('STUB'));
  if (isStub) return { ok: true, stub: true, rows: [] };

  const dataLines = allLines.filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'));
  if (dataLines.length === 0) {
    return { ok: false, error: 'Benchmark CSV has no data rows.' };
  }

  const header = dataLines[0]!.split(',').map((c) => c.trim());
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      return { ok: false, error: `Missing required column: ${col}` };
    }
  }
  const idx = (col: string): number => header.indexOf(col);

  const rows: BenchmarkRow[] = [];
  for (let i = 1; i < dataLines.length; i++) {
    const cells = dataLines[i]!.split(',').map((c) => c.trim());
    if (cells.length < REQUIRED_COLUMNS.length) {
      return { ok: false, error: `Row ${i + 1}: too few columns` };
    }
    const row: BenchmarkRow = {
      teamRank: parseInt(cells[idx('teamRank')]!, 10),
      schoolName: cells[idx('schoolName')]!,
      hittingPct: parseFloat(cells[idx('hittingPct')]!),
      killsPerSet: parseFloat(cells[idx('killsPerSet')]!),
      liberoDigsPerSet: parseFloat(cells[idx('liberoDigsPerSet')]!),
      blocksPerSet: parseFloat(cells[idx('blocksPerSet')]!),
      assistsPerSet: parseFloat(cells[idx('assistsPerSet')]!),
    };
    if (
      Number.isNaN(row.teamRank) ||
      Number.isNaN(row.hittingPct) ||
      Number.isNaN(row.killsPerSet) ||
      Number.isNaN(row.liberoDigsPerSet) ||
      Number.isNaN(row.blocksPerSet) ||
      Number.isNaN(row.assistsPerSet)
    ) {
      return { ok: false, error: `Row ${i + 1}: non-numeric value` };
    }
    rows.push(row);
  }
  return { ok: true, stub: false, rows };
}

/** Compute the top-25 averages from a real benchmark dataset. */
export function benchmarkTop25Averages(rows: readonly BenchmarkRow[]): {
  hittingPct: number;
  killsPerSet: number;
  liberoDigsPerSet: number;
  blocksPerSet: number;
  assistsPerSet: number;
} {
  if (rows.length === 0) {
    return {
      hittingPct: 0,
      killsPerSet: 0,
      liberoDigsPerSet: 0,
      blocksPerSet: 0,
      assistsPerSet: 0,
    };
  }
  const sum = (key: keyof BenchmarkRow): number => {
    let s = 0;
    for (const r of rows) {
      const v = r[key];
      if (typeof v === 'number') s += v;
    }
    return s;
  };
  return {
    hittingPct: sum('hittingPct') / rows.length,
    killsPerSet: sum('killsPerSet') / rows.length,
    liberoDigsPerSet: sum('liberoDigsPerSet') / rows.length,
    blocksPerSet: sum('blocksPerSet') / rows.length,
    assistsPerSet: sum('assistsPerSet') / rows.length,
  };
}
