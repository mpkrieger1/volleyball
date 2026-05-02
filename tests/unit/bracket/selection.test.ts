import { describe, it, expect } from 'vitest';
import { bracket } from '@vcd/shared';

function mkField(confCount: number, teamsPerConf: number) {
  const teams: bracket.TeamRow[] = [];
  const confs: bracket.ConferenceRow[] = [];
  for (let c = 0; c < confCount; c++) {
    const cid = `C${c}`;
    confs.push({ id: cid, abbr: `C${c}`, autoBidEligible: true });
    for (let t = 0; t < teamsPerConf; t++) {
      teams.push({
        id: `${cid}T${t}`,
        abbr: `${cid}T${t}`,
        schoolName: `${cid} School ${t}`,
        conferenceId: cid,
        region: 'CENTRAL',
      });
    }
  }
  return { teams, confs };
}

describe('selectField', () => {
  it('returns exactly 64 teams when the pool is adequate', () => {
    const { teams, confs } = mkField(32, 10); // 320 teams
    const metrics: bracket.TeamMetricInput[] = teams.map((t, i) => ({
      teamId: t.id,
      wins: 20,
      losses: 5,
      metricRank: i + 1,
    }));
    // Top team in each conf = auto-bid; top-of-conference is the lowest index.
    const autoBids = confs.map((c) => {
      const winner = teams.find((t) => t.conferenceId === c.id)!;
      return { teamId: winner.id, conferenceId: c.id };
    });
    const field = bracket.selectField(teams, confs, metrics, autoBids);
    expect(field.length).toBe(64);
    const autoCount = field.filter((f) => f.autoBid).length;
    expect(autoCount).toBe(32);
  });

  it('excludes sub-.500 teams from the at-large pool', () => {
    const { teams, confs } = mkField(32, 10);
    // Half the teams are 4-20; they must not be at-larges.
    const metrics: bracket.TeamMetricInput[] = teams.map((t, i) => ({
      teamId: t.id,
      wins: i < 100 ? 20 : 4,
      losses: i < 100 ? 5 : 20,
      metricRank: i + 1,
    }));
    const autoBids = confs.map((c) => {
      const winner = teams.find((t) => t.conferenceId === c.id)!;
      return { teamId: winner.id, conferenceId: c.id };
    });
    const field = bracket.selectField(teams, confs, metrics, autoBids);
    const subFive = field.filter((f) => {
      const m = metrics.find((mm) => mm.teamId === f.teamId)!;
      return !f.autoBid && m.wins / (m.wins + m.losses) < 0.5;
    });
    expect(subFive).toHaveLength(0);
  });

  it('caps at-larges per conference', () => {
    const { teams, confs } = mkField(32, 10);
    const metrics: bracket.TeamMetricInput[] = teams.map((t, i) => ({
      teamId: t.id,
      wins: 20,
      losses: 5,
      metricRank: i + 1,
    }));
    const autoBids = confs.map((c) => {
      const winner = teams.find((t) => t.conferenceId === c.id)!;
      return { teamId: winner.id, conferenceId: c.id };
    });
    const field = bracket.selectField(teams, confs, metrics, autoBids, {
      maxAtLargePerConference: 2,
    });
    const byConf = new Map<string, number>();
    for (const s of field) byConf.set(s.conferenceId, (byConf.get(s.conferenceId) ?? 0) + 1);
    for (const [, n] of byConf) expect(n).toBeLessThanOrEqual(1 + 2); // 1 auto + 2 at-large
  });
});
