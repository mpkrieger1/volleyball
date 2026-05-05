// Sprint 14: initial roster generator for new save-slot DBs.
//
// Each team gets 17 players (Sprint 28 composition; see POSITION_MIX) with class
// years. Position mix: 4 OH, 3 MB, 2 OPP, 1 S, 1 L, 1 DS. Ratings scale
// with team prestige (higher prestige = higher mean rating).

import { createRng } from '../rng';
import { FIRST_NAMES, LAST_NAMES } from '../recruiting/nameData';
import { weightedPick, sampleHeight } from '../recruiting/ratings';
import { POSITION_ARCHETYPES } from '../recruiting/positionArchetypes';
import { applyArchetype } from '../recruiting/ratings';
import { sampleBaseRating, samplePotential, type Stars } from '../recruiting/starDistribution';
import type { Position } from '../recruiting/types';
import type { PlayerRatings } from '../sim/ratings';
import { deriveOverall } from '../stats/playerAggregate';

/** Headroom added on top of OVR when sampling potential floor. Keeps every
 *  fresh-generated player with at least this much developmental ceiling
 *  above their current ability. 5 points = "noticeable upside" without
 *  forcing every 5-star to peak at 100. */
const POTENTIAL_HEADROOM_OVER_OVR = 5;

export type ClassYear = 'FR' | 'SO' | 'JR' | 'SR';

/**
 * Rough star tier derived from team prestige, used to pick a
 * base-rating band. Top blue-bloods field mostly 3-4 star players;
 * low-majors field 1-2 stars.
 */
function prestigeToStarTier(prestige: number, rng: ReturnType<typeof createRng>): Stars {
  // Use the prestige as a bias against a per-player roll. Higher prestige
  // → higher expected star tier, with variance.
  const roll = rng.next() * 100;
  const threshold = prestige + (roll - 50) * 0.6; // ±30 centered on prestige
  if (threshold >= 88) return 5;
  if (threshold >= 72) return 4;
  if (threshold >= 52) return 3;
  if (threshold >= 35) return 2;
  return 1;
}

export type GeneratedPlayer = {
  firstName: string;
  lastName: string;
  position: Position;
  classYear: ClassYear;
  height: number; // cm
  jersey: number;
  ratings: PlayerRatings;
  potential: number;
  isLibero: boolean;
};

// Sprint 28: NCAA-realistic 17-player roster composition. Each skill
// position has a starter + backup at minimum, plus depth where it's
// most needed (OH and MB rotate front/back row regularly so 4 each
// gives meaningful 2-deep coverage; OPP gets 3 since the position is
// front-row-heavy). DS rounds out the 17-player cap.
//   S   : 2 (starter + backup)
//   OH  : 4 (starter + backup + 2 more)
//   MB  : 4 (starter + backup + 2 more)
//   OPP : 3 (starter + backup + 1 more)
//   L   : 2 (starter + backup)
//   DS  : 2 (back-row utility)
//   total = 17 (matches MAX_ROSTER_SIZE)
const POSITION_MIX: Array<{ position: Position; count: number }> = [
  { position: 'OH', count: 4 },
  { position: 'MB', count: 4 },
  { position: 'OPP', count: 3 },
  { position: 'S', count: 2 },
  { position: 'L', count: 2 },
  { position: 'DS', count: 2 },
];

const CLASS_YEARS: ClassYear[] = ['FR', 'SO', 'JR', 'SR'];

/**
 * Generate 17 deterministic players for a team. Composition matches
 * NCAA-realistic depth (see POSITION_MIX above) and lands exactly at
 * MAX_ROSTER_SIZE (Sprint 28).
 */
export function generateRosterForTeam(
  teamAbbr: string,
  teamPrestige: number,
): GeneratedPlayer[] {
  const rng = createRng(`roster:${teamAbbr}`);
  const out: GeneratedPlayer[] = [];
  const usedJerseys = new Set<number>();

  // Build the 17 slots: each position gets its count from POSITION_MIX,
  // with class-year rotation cycling through FR/SO/JR/SR to spread
  // talent across years (Sprint 28).
  const slots: Array<{ position: Position }> = [];
  for (const p of POSITION_MIX) {
    for (let i = 0; i < p.count; i++) slots.push({ position: p.position });
  }

  slots.forEach((slot, slotIdx) => {
    const localRng = rng.fork(`slot:${slotIdx}`);
    const classYear = CLASS_YEARS[slotIdx % 4]!;

    const firstEntry = weightedPick(localRng.fork('first'), FIRST_NAMES);
    const lastEntry = weightedPick(localRng.fork('last'), LAST_NAMES);

    const stars = prestigeToStarTier(teamPrestige, localRng.fork('stars'));
    const base = sampleBaseRating(localRng.fork('base'), stars);
    const archetype = POSITION_ARCHETYPES[slot.position];
    const ratings = applyArchetype(localRng.fork('per-key'), base, archetype);
    // Compute OVR FIRST so potential's floor can be clamped to OVR + headroom.
    // Without this, a low-end Gaussian draw could produce potential < OVR,
    // violating the "developmental ceiling" semantic.
    const overall = deriveOverall(slot.position, ratings);
    const potential = samplePotential(
      localRng.fork('potential'),
      stars,
      Math.min(100, overall + POTENTIAL_HEADROOM_OVER_OVR),
    );
    const height = sampleHeight(localRng.fork('height'), archetype);

    // Unique jersey 1-99 per team.
    const jerseyRng = localRng.fork('jersey');
    let jersey = jerseyRng.int(1, 99);
    while (usedJerseys.has(jersey)) {
      jersey = jerseyRng.int(1, 99);
    }
    usedJerseys.add(jersey);

    out.push({
      firstName: firstEntry.name,
      lastName: lastEntry.name,
      position: slot.position,
      classYear,
      height,
      jersey,
      ratings,
      potential,
      isLibero: slot.position === 'L',
    });
  });

  return out;
}
