// Shared parser for rally fixture JSON. Both the regen script and the golden
// test harness must use this — silent drift between parsers has bitten us.

import { PlayerLineupSchema, TeamSideSchema } from './lineup';
import { RotationStateSchema } from './rotation';
import { LiberoStateSchema } from './libero';

export type RallyFixtureInput = {
  seed: number | string;
  home: ReturnType<typeof PlayerLineupSchema.parse>;
  away: ReturnType<typeof PlayerLineupSchema.parse>;
  servingTeam: 'home' | 'away';
  homeRotation?: ReturnType<typeof RotationStateSchema.parse>;
  awayRotation?: ReturnType<typeof RotationStateSchema.parse>;
  homeLibero?: ReturnType<typeof LiberoStateSchema.parse>;
  awayLibero?: ReturnType<typeof LiberoStateSchema.parse>;
  homeSetterIndex?: number;
  awaySetterIndex?: number;
};

export function parseRallyFixtureInput(raw: unknown): RallyFixtureInput {
  const r = raw as Record<string, unknown>;
  const out: RallyFixtureInput = {
    seed: r.seed as number | string,
    home: PlayerLineupSchema.parse(r.home),
    away: PlayerLineupSchema.parse(r.away),
    servingTeam: TeamSideSchema.parse(r.servingTeam),
  };
  if (r.homeRotation) out.homeRotation = RotationStateSchema.parse(r.homeRotation);
  if (r.awayRotation) out.awayRotation = RotationStateSchema.parse(r.awayRotation);
  if (r.homeLibero) out.homeLibero = LiberoStateSchema.parse(r.homeLibero);
  if (r.awayLibero) out.awayLibero = LiberoStateSchema.parse(r.awayLibero);
  if (typeof r.homeSetterIndex === 'number') out.homeSetterIndex = r.homeSetterIndex;
  if (typeof r.awaySetterIndex === 'number') out.awaySetterIndex = r.awaySetterIndex;
  return out;
}
