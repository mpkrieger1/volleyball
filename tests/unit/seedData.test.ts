import { describe, expect, it } from 'vitest';
import { loadConferences, loadExpectedCounts, loadTeams } from '../../prisma/seedCsv';

describe('seed data integrity', () => {
  const expected = loadExpectedCounts();
  const confs = loadConferences();
  const teams = loadTeams();

  it('conferences.csv row count matches expected-counts.json', () => {
    expect(confs.length).toBe(expected.conferences);
  });

  it('teams.csv row count matches expected-counts.json', () => {
    expect(teams.length).toBe(expected.teams);
  });

  it('every team references an existing conference', () => {
    const confIds = new Set(confs.map((c) => c.id));
    const orphans = teams.filter((t) => !confIds.has(t.conferenceId));
    expect(orphans).toEqual([]);
  });

  it('every team has both colors as 7-char hex strings (PRD exit test 3)', () => {
    for (const t of teams) {
      expect(t.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('team abbreviations are unique', () => {
    const abbrs = teams.map((t) => t.abbr);
    expect(new Set(abbrs).size).toBe(abbrs.length);
  });

  it('team school names are unique', () => {
    const names = teams.map((t) => t.schoolName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('conference ids and abbrs are unique', () => {
    const ids = confs.map((c) => c.id);
    const abbrs = confs.map((c) => c.abbr);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(abbrs).size).toBe(abbrs.length);
  });

  it('every team resolves to exactly one conference (PRD exit test 3)', () => {
    const byTeam = new Map<string, number>();
    for (const t of teams) {
      byTeam.set(t.schoolName, (byTeam.get(t.schoolName) ?? 0) + 1);
    }
    for (const [name, count] of byTeam) {
      expect(count, `${name} should appear exactly once`).toBe(1);
    }
  });
});
