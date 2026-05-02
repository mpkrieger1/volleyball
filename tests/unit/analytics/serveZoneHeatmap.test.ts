import { describe, expect, it } from 'vitest';
import { analytics, type sim } from '@vcd/shared';

function rally(
  servingTeam: 'home' | 'away',
  events: sim.RallyEvent[],
): sim.MatchPbp['sets'][0]['rallies'][0] {
  return { rallyIndex: 0, seed: 's', servingTeam, winningTeam: 'home', events };
}

function makePbp(rallies: ReturnType<typeof rally>[]): sim.MatchPbp {
  return {
    version: 1,
    winner: 'home',
    homeSetsWon: 3,
    awaySetsWon: 0,
    sets: [{ setIndex: 0, homeScore: 25, awayScore: 0, rallies }],
  };
}

describe('computeServeZoneHeatmap', () => {
  it('attributes ace to zone 0 (home)', () => {
    const data = analytics.computeServeZoneHeatmap(
      makePbp([
        rally('home', [
          { kind: 'serve', tick: 0, team: 'home', server: 0, quality: 'ace' },
          { kind: 'point', tick: 1, winner: 'home', reason: 'service_ace' },
        ]),
      ]),
    );
    const homeZ0 = data.find((c) => c.servingTeam === 'home' && c.zone === 0);
    expect(homeZ0?.aces).toBe(1);
    expect(homeZ0?.errors).toBe(0);
    expect(homeZ0?.count).toBe(1);
  });

  it('attributes service error to zone 0', () => {
    const data = analytics.computeServeZoneHeatmap(
      makePbp([
        rally('away', [
          { kind: 'serve', tick: 0, team: 'away', server: 0, quality: 'error' },
          { kind: 'point', tick: 1, winner: 'home', reason: 'service_error' },
        ]),
      ]),
    );
    const awayZ0 = data.find((c) => c.servingTeam === 'away' && c.zone === 0);
    expect(awayZ0?.errors).toBe(1);
    expect(awayZ0?.aces).toBe(0);
  });

  it('in_play serve maps receiver slot → zone via SLOT_TO_ZONE', () => {
    const data = analytics.computeServeZoneHeatmap(
      makePbp([
        rally('home', [
          { kind: 'serve', tick: 0, team: 'home', server: 0, quality: 'in_play' },
          { kind: 'reception', tick: 1, team: 'away', receiver: 3, grade: 2 }, // slot 3 → zone 3
          { kind: 'point', tick: 2, winner: 'home', reason: 'kill' },
        ]),
      ]),
    );
    const homeZ3 = data.find((c) => c.servingTeam === 'home' && c.zone === 3);
    expect(homeZ3?.count).toBe(1);
  });

  it('returns 7 zones × 2 teams = 14 cells (zones 0..6)', () => {
    const data = analytics.computeServeZoneHeatmap(makePbp([]));
    expect(data).toHaveLength(14);
  });

  it('SLOT_TO_ZONE mapping matches plan', () => {
    expect(analytics.SLOT_TO_ZONE[0]).toBe(6);
    expect(analytics.SLOT_TO_ZONE[1]).toBe(1);
    expect(analytics.SLOT_TO_ZONE[2]).toBe(2);
    expect(analytics.SLOT_TO_ZONE[3]).toBe(3);
    expect(analytics.SLOT_TO_ZONE[4]).toBe(4);
    expect(analytics.SLOT_TO_ZONE[5]).toBe(5);
  });
});
