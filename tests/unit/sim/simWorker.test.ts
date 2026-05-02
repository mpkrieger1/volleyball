import { describe, expect, it } from 'vitest';
import { sim, simIpc } from '@vcd/shared';
import { runRally } from '../../../workers/src/simWorker';

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

const validRequest = (): simIpc.SimulateRallyRequest => ({
  kind: 'simulate_rally',
  seed: 'w-1',
  home: { team: 'home', players: Array.from({ length: 6 }, () => balanced()) },
  away: { team: 'away', players: Array.from({ length: 6 }, () => balanced()) },
  servingTeam: 'home',
});

describe('runRally', () => {
  it('returns ok with a schema-valid result for a valid request', () => {
    const res = runRally(validRequest());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(() => sim.RallyResultSchema.parse(res.result)).not.toThrow();
      expect(res.result.events[0]?.kind).toBe('serve');
    }
  });

  it('is deterministic across calls with identical input', () => {
    const a = runRally(validRequest());
    const b = runRally(validRequest());
    expect(a).toEqual(b);
  });

  it('rejects missing fields with INVALID_INPUT', () => {
    const res = runRally({ kind: 'simulate_rally' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_INPUT');
  });

  it('rejects wrong kind discriminator', () => {
    const res = runRally({ ...validRequest(), kind: 'bogus' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_INPUT');
  });

  it('rejects lineups with wrong player count', () => {
    const bad = validRequest();
    const res = runRally({ ...bad, home: { team: 'home', players: bad.home.players.slice(0, 5) } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_INPUT');
  });

  it('response parses against its zod schema', () => {
    const res = runRally(validRequest());
    expect(() => simIpc.SimulateRallyResponse.parse(res)).not.toThrow();
  });
});
