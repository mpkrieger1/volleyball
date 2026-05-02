// Pure CSV helpers used by seed.ts and the unit tests. No Prisma imports here so
// the unit tests can read and validate the CSVs without spinning up a DB.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConferenceSchema, TeamSchema, type ConferenceInput, type TeamInput } from '../shared/src/domain/team';

const SEED_DIR = resolve(__dirname, 'seedData');

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const header = lines[0]!.split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((key, i) => (row[key] = (cells[i] ?? '').trim()));
    return row;
  });
}

export type ExpectedCounts = { conferences: number; teams: number };

export function loadExpectedCounts(): ExpectedCounts {
  const raw = JSON.parse(readFileSync(resolve(SEED_DIR, 'expected-counts.json'), 'utf8'));
  return { conferences: raw.conferences, teams: raw.teams };
}

export function loadConferences(): ConferenceInput[] {
  const rows = parseCsv(readFileSync(resolve(SEED_DIR, 'conferences.csv'), 'utf8'));
  return rows.map((r) =>
    ConferenceSchema.parse({
      id: r.id,
      name: r.name,
      abbr: r.abbr,
      tier: r.tier,
      autoBidEligible: r.autoBidEligible === 'true',
    }),
  );
}

export function loadTeams(): TeamInput[] {
  const rows = parseCsv(readFileSync(resolve(SEED_DIR, 'teams.csv'), 'utf8'));
  return rows.map((r) =>
    TeamSchema.parse({
      schoolName: r.schoolName,
      abbr: r.abbr,
      conferenceId: r.conferenceId,
      primaryColor: r.primaryColor,
      secondaryColor: r.secondaryColor,
      prestige: Number(r.prestige),
      logoPath: `placeholder:${r.abbr}`,
    }),
  );
}
