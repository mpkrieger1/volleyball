// Rally-sim perf harness. Sprint 3 tracks single-rally time; Sprint 5's match
// loop will raise the single-match < 150 ms budget (PRD §3.5).

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

const times: number[] = [];
for (let i = 0; i < N; i++) {
  const t0 = performance.now();
  simulateRally({ seed: i, home: lineup('home'), away: lineup('away'), servingTeam: 'home' });
  times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
const p = (q: number) => times[Math.floor(times.length * q)]!;
const mean = times.reduce((a, b) => a + b, 0) / times.length;

console.log(`N=${N}`);
console.log(`rally mean: ${mean.toFixed(4)} ms`);
console.log(`rally p50:  ${p(0.5).toFixed(4)} ms`);
console.log(`rally p95:  ${p(0.95).toFixed(4)} ms`);
console.log(`rally p99:  ${p(0.99).toFixed(4)} ms`);
console.log(`total:      ${(mean * N).toFixed(1)} ms for ${N} rallies`);
