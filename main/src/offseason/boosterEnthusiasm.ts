// Sprint 16: compute booster enthusiasm from last season performance.
//
//   enthusiasm = clamp(50 + winPctDelta × 30 + tournamentBonus, 0, 100)
//   winPctDelta = lastSeasonWinPct - 0.5
//   tournamentBonus: champion +15, Final Four +8, made bracket +3, else 0

export type TournamentFinish = 'CHAMPION' | 'FINAL_FOUR' | 'MADE_BRACKET' | 'NONE';

const TOURNEY_BONUS: Record<TournamentFinish, number> = {
  CHAMPION: 15,
  FINAL_FOUR: 8,
  MADE_BRACKET: 3,
  NONE: 0,
};

export function computeEnthusiasm(
  winPct: number, // 0..1
  tournamentFinish: TournamentFinish,
): number {
  const winPctDelta = winPct - 0.5;
  const score = 50 + winPctDelta * 30 + TOURNEY_BONUS[tournamentFinish];
  return Math.max(0, Math.min(100, Math.round(score)));
}
