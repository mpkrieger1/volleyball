// Sprint 18 PRD exit test 1: every selected AA team has the correct
// positional composition (validated by rubric in test).
//
// Pure-function variant — no DB. Runs against `selectAllAmericans` directly
// over a synthetic season. The `computeAndPersist.test.ts` integration
// covers the full DB-backed path.

import { describe, expect, it } from 'vitest';
import { awards } from '@vcd/shared';
import { generateSyntheticSeason } from '../../fixtures/awards/syntheticSeason';

describe('PRD Sprint 18 exit test 1 — AA composition rubric', () => {
  it('every team has exactly 2 OH / 2 MB / 1 OPP / 1 S / 1 L', () => {
    const season = generateSyntheticSeason({ seed: 'exit-1' });
    const selections = awards.selectAllAmericans({ stats: season.stats, players: season.meta });
    expect(selections).toHaveLength(awards.AA_TOTAL_SELECTIONS);
    for (const team of awards.AA_TEAMS) {
      const teamSel = selections.filter((s) => s.team === team);
      expect(teamSel).toHaveLength(awards.AA_TEAM_SIZE);
      const counts = { OH: 0, MB: 0, OPP: 0, S: 0, L: 0 };
      for (const s of teamSel) counts[s.position as keyof typeof counts]!++;
      expect(counts).toEqual(awards.AA_COMPOSITION);
    }
  });

  it('no playerId appears more than once across all teams', () => {
    const season = generateSyntheticSeason({ seed: 'exit-1-dup' });
    const selections = awards.selectAllAmericans({ stats: season.stats, players: season.meta });
    const ids = new Set(selections.map((s) => s.playerId));
    expect(ids.size).toBe(selections.length);
  });
});
