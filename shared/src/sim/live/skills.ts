// Sprint 30 Task 30.2: skill enum, extracted from state.ts to break a
// circular import. coachActions.ts imports SkillKeySchema as a VALUE,
// and state.ts re-exports from coachActions.ts — which would cycle if
// SkillKeySchema lived in state.ts. ESM cycles with const exports
// produce TDZ errors at runtime in Vite (renderer black screen);
// CJS in Node tolerates them, which is why unit tests didn't catch it.
//
// Both state.ts and coachActions.ts now import from this leaf module.

import { z } from 'zod';

export const SkillKeySchema = z.enum(['serve', 'pass', 'attack', 'block', 'dig', 'set']);
export type SkillKey = z.infer<typeof SkillKeySchema>;
