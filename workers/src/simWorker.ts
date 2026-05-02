// Thin zod-validated wrapper around simulateRally(). Sprint 5's match loop will
// invoke this from a worker_thread; for now it's a pure synchronous function so
// tests can drive it directly.

import { simIpc } from '@vcd/shared';
import { simulateRally } from './sim/rally';

export function runRally(raw: unknown): simIpc.SimulateRallyResponse {
  const parsed = simIpc.SimulateRallyRequest.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: parsed.error.message.slice(0, 500) },
    };
  }
  try {
    const result = simulateRally({
      seed: parsed.data.seed,
      home: parsed.data.home,
      away: parsed.data.away,
      servingTeam: parsed.data.servingTeam,
    });
    return { ok: true, result };
  } catch (err) {
    return {
      ok: false,
      error: { code: 'INTERNAL', message: (err as Error).message },
    };
  }
}
