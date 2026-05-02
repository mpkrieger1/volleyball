// Seeded RNG — the ONLY source of randomness allowed in sim/scheduler code.
// CLAUDE.md §Determinism: never reach for Math.random(). Tests rely on this.
//
// Implementation: mulberry32 (small, fast, good enough for game sim; not cryptographic).

export type Rng = {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Returns true with probability p (clamped to [0,1]). */
  chance(p: number): boolean;
  /** Picks one element from a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Forks a deterministic child RNG — lets subsystems draw without leaking state. */
  fork(label: string): Rng;
  /** Current internal state, for serialization / debugging. */
  state(): number;
};

/** Hash a string to a 32-bit seed (xmur3). Lets us derive sub-seeds from labels. */
export function hashSeed(label: string): number {
  let h = 1779033703 ^ label.length;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return next() < p;
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)] as T;
    },
    fork(label) {
      return createRng(hashSeed(`${state}:${label}`));
    },
    state() {
      return state;
    },
  };
  return rng;
}
