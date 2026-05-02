// Creates the 6 rotation fixtures + libero-swap fixture under
// tests/fixtures/rally/. Run once; the generated inputs are committed. Expected
// halves are produced by the regen-rally-fixture script.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sim } from '@vcd/shared';

const dir = resolve(__dirname, '../tests/fixtures/rally');

const balancedPlayer = {
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
};

const lineup = (team: 'home' | 'away') => ({
  team,
  players: Array.from({ length: 6 }, () => ({ ...balancedPlayer })),
});

for (let i = 0; i < 6; i++) {
  const homeRot = sim.rotateBy(sim.initialRotation(), i);
  const fixture = {
    seed: `rotation-${i}`,
    servingTeam: 'home',
    home: lineup('home'),
    away: lineup('away'),
    homeRotation: homeRot,
    awayRotation: sim.initialRotation(),
    homeSetterIndex: 0,
    awaySetterIndex: 0,
  };
  writeFileSync(
    resolve(dir, `rotation-${i}.input.json`),
    JSON.stringify(fixture, null, 2) + '\n',
    'utf8',
  );
}

// Libero swap fixture: libero (index 5) pairs with P5 player on the home team.
const liberoHomeRot = sim.initialRotation();
const liberoFixture = {
  seed: 'libero-swap',
  servingTeam: 'away', // home receives so libero is active
  home: lineup('home'),
  away: lineup('away'),
  homeRotation: liberoHomeRot,
  awayRotation: sim.initialRotation(),
  homeLibero: sim.liberoReplace(sim.liberoOff(5), liberoHomeRot, sim.playerAt(liberoHomeRot, 'P5')),
  homeSetterIndex: 0,
  awaySetterIndex: 0,
};
writeFileSync(
  resolve(dir, 'libero-swap.input.json'),
  JSON.stringify(liberoFixture, null, 2) + '\n',
  'utf8',
);

console.log('wrote 6 rotation fixtures + libero-swap.input.json');
