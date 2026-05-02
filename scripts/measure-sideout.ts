// Quick measurement harness — not a test. Prints the side-out rate + contacts
// distribution for N balanced rallies so the knobs in tuning.ts can be swept.

import { sim } from '@vcd/shared';
import { simulateRally } from '../workers/src/sim/rally';

const N = Number(process.env.N ?? 10_000);

const balanced = (): sim.PlayerRatings => ({
  attack: 50,
  block: 50,
  serve: 50,
  pass: 50,
  set: 50,
  dig: 50,
  athleticism: 50,
  iq: 50,
  stamina: 50,
});

const lineup = (team: sim.TeamSide): sim.PlayerLineup => ({
  team,
  players: Array.from({ length: 6 }, () => balanced()),
});

let sideOuts = 0;
let _holds = 0;
let totalContacts = 0;
const contactHist = new Map<number, number>();

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const serving: sim.TeamSide = i % 2 === 0 ? 'home' : 'away';
  const homeRot = sim.rotateBy(sim.initialRotation(), i % 6);
  const awayRot = sim.rotateBy(sim.initialRotation(), (i + 3) % 6);
  const res = simulateRally({
    seed: `m-${i}`,
    home: lineup('home'),
    away: lineup('away'),
    servingTeam: serving,
    homeRotation: homeRot,
    awayRotation: awayRot,
    homeLibero: sim.liberoOff(5),
    awayLibero: sim.liberoOff(5),
    homeSetterIndex: 0,
    awaySetterIndex: 0,
  });
  if (res.winningTeam === serving) _holds += 1;
  else sideOuts += 1;
  totalContacts += res.contacts;
  contactHist.set(res.contacts, (contactHist.get(res.contacts) ?? 0) + 1);
}
const elapsed = Date.now() - t0;

const sideOutRate = sideOuts / N;
console.log(`N=${N}`);
console.log(`side-out rate: ${(sideOutRate * 100).toFixed(2)}%  (target ~65%, ±3%)`);
console.log(`mean contacts: ${(totalContacts / N).toFixed(2)}`);
console.log(`elapsed: ${elapsed} ms  (${(elapsed / N).toFixed(3)} ms/rally)`);
const sorted = [...contactHist.entries()].sort((a, b) => a[0] - b[0]);
console.log('contacts: ' + sorted.map(([c, n]) => `${c}:${n}`).join('  '));
