// Intentionally regenerate a rally golden fixture. Per CLAUDE.md §Golden fixtures,
// this must be run as a deliberate act with a commit message that explains why.
//
// Usage: npx tsx scripts/regen-rally-fixture.ts <case-name>
// where <case-name>.input.json lives under tests/fixtures/rally/ and the script
// writes <case-name>.expected.json alongside it.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { simulateRally } from '../workers/src/sim/rally';
import { sim } from '@vcd/shared';

const name = process.argv[2];
if (!name) {
  console.error('usage: npx tsx scripts/regen-rally-fixture.ts <case-name>');
  process.exit(1);
}

const dir = resolve(__dirname, '../tests/fixtures/rally');
const inputPath = resolve(dir, `${name}.input.json`);
const outPath = resolve(dir, `${name}.expected.json`);

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const input = sim.parseRallyFixtureInput(raw);

const result = simulateRally(input);
sim.RallyResultSchema.parse(result);
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(`wrote ${outPath}`);
console.log(`  events=${result.events.length}  contacts=${result.contacts}  winner=${result.winningTeam}`);
