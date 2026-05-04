// Sprint 28: NIL is open during the offseason cycle (OFFSEASON / RECRUITING /
// PORTAL / PRESEASON) and closed once the regular season begins. The window
// opens at the start of OFFSEASON (right after the NCAA championship match)
// and closes when startRegular flips Season.phase → REGULAR.
//
// Pure helper so both the renderer (UI gate) and main (IPC enforcement)
// agree on the rule.

export const NIL_OPEN_PHASES = [
  'OFFSEASON',
  'RECRUITING',
  'PORTAL',
  'PRESEASON',
] as const;

export type NilPhase = (typeof NIL_OPEN_PHASES)[number];

export function isNilOpen(phase: string | null | undefined): boolean {
  if (!phase) return false;
  return (NIL_OPEN_PHASES as readonly string[]).includes(phase);
}
