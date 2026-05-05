// Sprint 12: HS recruit class generator.
//
// Contract: deterministic. Identical (seed, index) → byte-identical
// GeneratedRecruit. Class generation keeps a seen-set of
// (firstName, lastName, hometownCity) triples and re-rolls the name
// portion on collision (up to MAX_NAME_RETRIES).

import { createRng, type Rng } from '../rng';
import { FIRST_NAMES, LAST_NAMES, HOMETOWNS } from './nameData';
import { POSITION_ARCHETYPES, POSITION_DISTRIBUTION } from './positionArchetypes';
import { sampleStars, sampleBaseRating, samplePotential } from './starDistribution';
import { deriveOverall } from '../stats/playerAggregate';
import { applyArchetype, sampleHeight, weightedPick } from './ratings';
import type { GeneratedRecruit, Position } from './types';

const MAX_NAME_RETRIES = 25;

export function generateRecruit(seed: string | number, index: number): GeneratedRecruit {
  const root = createRng(`${seed}:${index}`);
  return buildRecruit(root);
}

function buildRecruit(root: Rng, overrideNames?: { firstName: string; lastName: string; hometown: typeof HOMETOWNS[number] }): GeneratedRecruit {
  const positionRng = root.fork('position');
  const starRng = root.fork('star');
  const nameRng = root.fork('name');
  const hometownRng = root.fork('hometown');
  const ratingRng = root.fork('rating');
  const heightRng = root.fork('height');

  const position = weightedPick(positionRng, POSITION_DISTRIBUTION).position as Position;
  const stars = sampleStars(starRng);
  const archetype = POSITION_ARCHETYPES[position];

  const firstEntry = overrideNames
    ? { name: overrideNames.firstName, tag: 'GENERAL' as const, weight: 1 }
    : weightedPick(nameRng.fork('first'), FIRST_NAMES);
  const lastEntry = overrideNames
    ? { name: overrideNames.lastName, tag: 'GENERAL' as const, weight: 1 }
    : weightedPick(nameRng.fork('last'), LAST_NAMES);
  const hometown = overrideNames
    ? overrideNames.hometown
    : weightedPick(hometownRng, HOMETOWNS);

  const base = sampleBaseRating(ratingRng.fork('base'), stars);
  const ratings = applyArchetype(ratingRng.fork('per-key'), base, archetype);
  // Potential floor = current OVR + 5 headroom so the developmental
  // ceiling never lands below the player's current ability (cf.
  // playerGenerator.ts and shared/src/recruiting/starDistribution.ts).
  // Recruits are HS players — even a 1-star kid has >= 5 points of
  // upside above their current rating.
  const overallNow = deriveOverall(position, ratings);
  const potential = samplePotential(
    ratingRng.fork('potential'),
    stars,
    Math.min(100, overallNow + 5),
  );
  const height = sampleHeight(heightRng, archetype);

  return {
    firstName: firstEntry.name,
    lastName: lastEntry.name,
    position,
    stars,
    height,
    hometownCity: hometown.city,
    hometownState: hometown.state,
    hometownRegion: hometown.region,
    ratings,
    potential,
  };
}

/**
 * Generate a deterministic class of `size` recruits. Guarantees no
 * duplicate (firstName, lastName, hometownCity) triples.
 *
 * On collision, re-draws only the name + hometown components (keeping
 * position, stars, ratings, height, potential stable) up to
 * MAX_NAME_RETRIES. With ~55M combinations and classes of 1k–1.5k, a
 * retry is needed on <1% of slots in practice.
 */
export function generateRecruitClass(seed: string | number, size: number): GeneratedRecruit[] {
  const out: GeneratedRecruit[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < size; i++) {
    const baseRecruit = generateRecruit(seed, i);
    let recruit = baseRecruit;
    let key = tripleKey(recruit);

    if (seen.has(key)) {
      // Reroll using a perturbed sub-seed until we land on a fresh triple.
      for (let attempt = 1; attempt <= MAX_NAME_RETRIES; attempt++) {
        const root = createRng(`${seed}:${i}:retry-${attempt}`);
        const nameRng = root.fork('name');
        const hometownRng = root.fork('hometown');
        const first = weightedPick(nameRng.fork('first'), FIRST_NAMES);
        const last = weightedPick(nameRng.fork('last'), LAST_NAMES);
        const ht = weightedPick(hometownRng, HOMETOWNS);
        const candidate: GeneratedRecruit = {
          ...baseRecruit,
          firstName: first.name,
          lastName: last.name,
          hometownCity: ht.city,
          hometownState: ht.state,
          hometownRegion: ht.region,
        };
        const k = tripleKey(candidate);
        if (!seen.has(k)) {
          recruit = candidate;
          key = k;
          break;
        }
      }
    }

    seen.add(key);
    out.push(recruit);
  }
  return out;
}

function tripleKey(r: GeneratedRecruit): string {
  return `${r.firstName}|${r.lastName}|${r.hometownCity}`;
}
