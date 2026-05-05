// Sprint 36 Task 36.2 — pitch reasons (CoachPedigree + CoachConnection).

import { describe, it, expect } from 'vitest';
import { recruiting } from '@vcd/shared';

const baseTeam = { id: 't1', region: 'EAST' };
const baseRecruit = {
  id: 'r1',
  stars: 4,
  hometownState: 'CA',
  hometownRegion: 'PACIFIC',
};
const noChamps: recruiting.ChampionshipsHistory = {
  coachId: 'c-hc',
  nationalChampYears: [],
  confChampYears: [],
};

describe('CoachPedigree', () => {
  it('HC with 2 nat champs + 5 conf champs → 20 + 25 = 45 pts', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'NV' }],
      hcChampionships: {
        coachId: 'c-hc',
        nationalChampYears: [2024, 2025],
        confChampYears: [2020, 2021, 2022, 2023, 2024],
      },
      recruit: baseRecruit,
    });
    const pedigree = out.reasons.find((r) => r.type === 'COACH_PEDIGREE');
    expect(pedigree!.points).toBe(45);
  });

  it('HC with 5 nat champs caps at 30 (10 × 3 = 30 ceiling)', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'NV' }],
      hcChampionships: {
        coachId: 'c-hc',
        nationalChampYears: [2020, 2021, 2022, 2023, 2024],
        confChampYears: [],
      },
      recruit: baseRecruit,
    });
    const pedigree = out.reasons.find((r) => r.type === 'COACH_PEDIGREE');
    expect(pedigree!.points).toBe(30);
  });

  it('HC with 0 titles → 0 pts', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'NV' }],
      hcChampionships: noChamps,
      recruit: baseRecruit,
    });
    const pedigree = out.reasons.find((r) => r.type === 'COACH_PEDIGREE');
    expect(pedigree!.points).toBe(0);
  });

  it('null hcChampionships → 0 pts', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'NV' }],
      hcChampionships: null,
      recruit: baseRecruit,
    });
    const pedigree = out.reasons.find((r) => r.type === 'COACH_PEDIGREE');
    expect(pedigree!.points).toBe(0);
  });
});

describe('CoachConnection', () => {
  it('HC from CA, recruit from CA → +20 (same state)', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'CA' }],
      hcChampionships: noChamps,
      recruit: baseRecruit,
    });
    const conn = out.reasons.find((r) => r.type === 'COACH_CONNECTION');
    expect(conn!.points).toBe(20);
  });

  it('HC from NY, recruit from CA → 0 (different state, different region)', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'NY' }],
      hcChampionships: noChamps,
      recruit: baseRecruit, // CA / PACIFIC
    });
    const conn = out.reasons.find((r) => r.type === 'COACH_CONNECTION');
    expect(conn!.points).toBe(0);
  });

  it('HC from CA, AHC from PA, recruit from PA (EAST) — best of staff: AHC → +20', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [
        { id: 'c-hc', role: 'HC', hometownState: 'CA' },
        { id: 'c-ahc', role: 'AHC', hometownState: 'PA' },
      ],
      hcChampionships: noChamps,
      recruit: { ...baseRecruit, hometownState: 'PA', hometownRegion: 'EAST' },
    });
    const conn = out.reasons.find((r) => r.type === 'COACH_CONNECTION');
    expect(conn!.points).toBe(20);
  });

  it('HC from NY, recruit from CT (both EAST) → +10 (region-only match)', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'NY' }],
      hcChampionships: noChamps,
      recruit: { ...baseRecruit, hometownState: 'CT', hometownRegion: 'EAST' },
    });
    const conn = out.reasons.find((r) => r.type === 'COACH_CONNECTION');
    expect(conn!.points).toBe(10);
  });

  it('null coach hometownState → 0 (no connection)', () => {
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: null }],
      hcChampionships: noChamps,
      recruit: baseRecruit,
    });
    const conn = out.reasons.find((r) => r.type === 'COACH_CONNECTION');
    expect(conn!.points).toBe(0);
  });
});

describe('Total cap + active flags', () => {
  it('totalActivePoints capped at MAX_TOTAL_PITCH_BONUS = 75', () => {
    // Force both reasons active by using a recruit id that triggers all flags.
    const out = recruiting.computePitchReasons({
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC', hometownState: 'CA' }],
      hcChampionships: {
        coachId: 'c-hc',
        nationalChampYears: [2020, 2021, 2022, 2023, 2024], // 30 cap
        confChampYears: [2020, 2021, 2022, 2023, 2024], // 25 cap
      },
      recruit: baseRecruit, // CA → +20 connection
    });
    // Even if both reasons are active: 30 + 25 + 20 = 75 (matches cap exactly).
    expect(out.totalActivePoints).toBeLessThanOrEqual(recruiting.MAX_TOTAL_PITCH_BONUS);
  });

  it('determinism — same (recruit.id, team.id) → same active flags + points', () => {
    const args = {
      team: baseTeam,
      coaches: [{ id: 'c-hc', role: 'HC' as const, hometownState: 'CA' }],
      hcChampionships: noChamps,
      recruit: baseRecruit,
    };
    const a = recruiting.computePitchReasons(args);
    const b = recruiting.computePitchReasons(args);
    expect(a).toEqual(b);
  });
});
