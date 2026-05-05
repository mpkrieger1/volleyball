// Sprint 35 Task 35.3 — load academic-elite team CSV. Mirrors the Sprint 32
// facilities-tier seed pattern. CSV at `prisma/seedData/teamAcademics.csv`
// with 2 cols: abbr, academicsLevel. Teams not listed default to 50 (the
// schema default).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadTeamAcademics(repoRoot: string): Map<string, number> {
  const path = join(repoRoot, 'prisma', 'seedData', 'teamAcademics.csv');
  const raw = readFileSync(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Skip the header line.
  const out = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(',').map((p) => p.trim());
    if (parts.length < 2) continue;
    const abbr = parts[0]!;
    const level = Number(parts[1]);
    if (!Number.isFinite(level)) continue;
    out.set(abbr, Math.round(level));
  }
  return out;
}
