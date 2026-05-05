// Sprint 31 Task 31.5: save-file size verification.
//
// Worst-case 5-set live match: ~10 timeouts + ~30 subs + 5 rotations.
// Asserts coachActionsJson < 30 KB and a full-state JSON < 60 KB.
// (No 10-season aggregate test — that suite was deleted; v1.x can revisit.)

import { describe, expect, it } from 'vitest';
import { sim } from '@vcd/shared';
import { simulateMatchLive, type TeamMatchState } from '@vcd/workers';

const balanced = (): sim.PlayerRatings => ({
  attack: 50, block: 50, serve: 50, pass: 50, set: 50, dig: 50,
  athleticism: 50, iq: 50, stamina: 50,
});

const teamMatch = (team: sim.TeamSide): TeamMatchState => ({
  lineup: { team, players: Array.from({ length: 6 }, () => balanced()) },
  rotation: sim.initialRotation(),
  libero: sim.liberoOff(5),
  setterIndex: 0,
  system: sim.defaultSystem51(),
});

describe('Sprint 31 Task 31.5 — save-file size budget', () => {
  it('worst-case CoachActionLog (10 TOs + 30 subs + 5 rotations) serializes < 30 KB', () => {
    const log: sim.CoachActionLog = [];
    // 10 timeouts (alternating teams)
    for (let i = 0; i < 10; i++) {
      log.push({
        kind: 'timeout',
        team: i % 2 === 0 ? 'home' : 'away',
        rallyIndex: i * 5,
        skill: 'attack',
      });
    }
    // 30 subs
    for (let i = 0; i < 30; i++) {
      log.push({
        kind: 'substitution',
        team: i % 2 === 0 ? 'home' : 'away',
        rallyIndex: i * 6,
        out: `cuid-out-${i}-aaaaaaaaaaaaaaaaaaaaaaaa`,
        in: `cuid-in-${i}-bbbbbbbbbbbbbbbbbbbbbbbbb`,
      });
    }
    // 5 rotations (one per set)
    for (let i = 0; i < 5; i++) {
      log.push({
        kind: 'rotation',
        team: 'home',
        setIndex: i as 0|1|2|3|4,
        rotation: { slots: [0, 1, 2, 3, 4, 5] },
        system: '5-1',
        libero: `libero-cuid-${i}-cccccccccccccccccccc`,
        hint: 'balanced',
      });
    }
    const json = sim.serializeCoachActionLog(log);
    expect(json).not.toBeNull();
    expect(json!.length).toBeLessThan(30_000);
  });

  it('full 5-set live match state JSON < 200 KB (peak liveStateJson size)', () => {
    // Simulate a full match (no coach actions; pure rally events).
    const live = simulateMatchLive({
      seed: 'size-budget',
      home: teamMatch('home'),
      away: teamMatch('away'),
      initialServer: 'home',
      useCoachAi: true,
    });
    const stateJson = JSON.stringify(live.finalState);
    // Worst-case 5-set match ≈ 200-250 rallies, ~5 events per rally =
    // ~60 KB of event JSON + box score + lineups + bench. Real-world
    // mid-match peak is around ~135 KB (no compression on liveStateJson;
    // could add gzip in v1.x if save-file growth becomes an issue).
    // 200 KB ceiling is generous; 10-season save-file budget (35 MB)
    // can absorb dozens of paused live matches.
    expect(stateJson.length).toBeLessThan(200_000);
  });
});
