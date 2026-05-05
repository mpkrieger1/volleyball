// Sprint 32 Task 32.5 — port of FCCD module 22567.
// FCCD has HC/OC/DC; VCD has HC/AHC/AC, so AHC takes the offense pool and
// AC takes the defense pool. Multiple ACs on the same team all see the
// same AC pool (FCCD-equivalent behavior).

export type TrainableSkill =
  | 'attack' | 'block' | 'serve' | 'pass' | 'set' | 'dig'
  | 'athleticism' | 'iq' | 'stamina';

export type CoachRole = 'HC' | 'AHC' | 'AC';

export function getValidTrainingFocuses(role: CoachRole): TrainableSkill[] {
  switch (role) {
    case 'HC':
      return ['athleticism', 'iq', 'stamina'];
    case 'AHC':
      return ['attack', 'serve', 'set'];
    case 'AC':
      return ['block', 'pass', 'dig'];
  }
}
