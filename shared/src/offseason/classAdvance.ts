// Sprint 16: class-year state machine for offseason transitions.

export type ClassYear = 'FR' | 'SO' | 'JR' | 'SR' | 'GR';

export type AdvanceResult = {
  nextClassYear: ClassYear | null; // null means graduating/archived
  graduates: boolean;
};

/**
 * Advance a player by one season.
 *   FR → SO
 *   SO → JR
 *   JR → SR
 *   SR → graduate (null)
 *   GR → graduate (null)   — one GR year only this sprint
 */
export function advanceClass(player: { classYear: ClassYear }): AdvanceResult {
  switch (player.classYear) {
    case 'FR':
      return { nextClassYear: 'SO', graduates: false };
    case 'SO':
      return { nextClassYear: 'JR', graduates: false };
    case 'JR':
      return { nextClassYear: 'SR', graduates: false };
    case 'SR':
    case 'GR':
      return { nextClassYear: null, graduates: true };
  }
}
