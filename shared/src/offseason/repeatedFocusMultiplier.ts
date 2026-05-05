// Sprint 32 Task 32.2 — direct port of FCCD `getRepeatedTrainingsMultiplier`
// (module 935275 in coreWorker.js).
//
// `n` = how many times the same attribute focus has already been picked
// this offseason event (ahead of the current pick, by any coach on the team).
// Sprint 33 wires this into the training event apply-gain step.

export function getRepeatedFocusMultiplier(n: number): number {
  switch (n) {
    case 0:
      return 1.0;
    case 1:
      return 0.6;
    case 2:
      return 0.4;
    default:
      return 0.2;
  }
}
