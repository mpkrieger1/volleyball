import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(__dirname, '../../prisma/schema.prisma'),
  'utf8',
);

const REQUIRED_MODELS = [
  'Team',
  'Conference',
  'Player',
  'Coach',
  'Match',
  'Set',
  'PlayerMatchStat',
  'Recruit',
  'TransferPortal',
  'NilDeal',
  'Poll',
  'RPISnapshot',
  'Season',
  'Award',
  'Booster',
  'SaveSlot',
];

describe('prisma/schema.prisma', () => {
  it.each(REQUIRED_MODELS)('declares model %s', (name) => {
    expect(schema).toMatch(new RegExp(`^model ${name}\\s*\\{`, 'm'));
  });

  it('uses sqlite provider', () => {
    expect(schema).toMatch(/provider\s*=\s*"sqlite"/);
  });

  it('primary keys are cuid strings (no autoincrement Ints)', () => {
    expect(schema).not.toMatch(/@id\s*@default\(autoincrement\(\)\)/);
    expect(schema).toMatch(/@default\(cuid\(\)\)/);
  });

  it('Team requires non-null colors', () => {
    const teamBlock = schema.match(/model Team\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    // Colors declared as `String` (no trailing `?` means non-null in Prisma).
    expect(teamBlock).toMatch(/primaryColor\s+String\b(?!\?)/);
    expect(teamBlock).toMatch(/secondaryColor\s+String\b(?!\?)/);
  });
});
