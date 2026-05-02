// Pure probability functions. Every function returns a distribution whose
// values sum to exactly 1.0 and are each clamped to [0, 1]. Callers use a seeded
// RNG to sample from the returned distribution.

import type { PlayerRatings } from './ratings';
import { TUNING } from './tuning';

type Dist<K extends string> = { [P in K]: number };

const clamp = (x: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, x));

/** Normalize a distribution so it sums to 1 while preserving ratios. */
function normalize<K extends string>(d: Dist<K>): Dist<K> {
  const sum = Object.values<number>(d).reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // degenerate — fall back to uniform
    const keys = Object.keys(d) as K[];
    const u = 1 / keys.length;
    return Object.fromEntries(keys.map((k) => [k, u])) as Dist<K>;
  }
  const out = {} as Dist<K>;
  for (const k of Object.keys(d) as K[]) out[k] = d[k] / sum;
  return out;
}

// ─────────────────────────────────────────────────────────────
// SERVE
// ─────────────────────────────────────────────────────────────

export type ServeDist = Dist<'ace' | 'error' | 'in_play_good' | 'in_play_ok' | 'in_play_bad'>;

export function serveOutcome(server: PlayerRatings, receiver: PlayerRatings): ServeDist {
  const ace = clamp(
    TUNING.SERVE_ACE_BASE +
      TUNING.SERVE_ACE_PER_RATING * (server.serve - 50) +
      TUNING.SERVE_ACE_PASSER_PENALTY * (50 - receiver.pass),
  );
  const err = clamp(
    TUNING.SERVE_ERROR_BASE + TUNING.SERVE_ERROR_PER_RATING * (server.serve - 50),
  );
  const remaining = Math.max(0, 1 - ace - err);
  // Split remaining across in_play buckets biased by serve quality.
  const qBias = (server.serve - 50) / 100; // -0.5..+0.5
  const goodShare = clamp(0.25 + 0.4 * qBias, 0.05, 0.75);
  const badShare = clamp(0.35 - 0.4 * qBias, 0.05, 0.75);
  const okShare = Math.max(0, 1 - goodShare - badShare);
  return normalize({
    ace,
    error: err,
    in_play_good: remaining * goodShare,
    in_play_ok: remaining * okShare,
    in_play_bad: remaining * badShare,
  });
}

// ─────────────────────────────────────────────────────────────
// RECEPTION
// ─────────────────────────────────────────────────────────────

export type ReceptionDist = Dist<'perfect' | 'good' | 'ok' | 'bad'>;
export type InPlayServeQuality = 'in_play_good' | 'in_play_ok' | 'in_play_bad';

export function receptionOutcome(
  receiver: PlayerRatings,
  serveQuality: InPlayServeQuality,
): ReceptionDist {
  const passDelta = (receiver.pass - 50) * TUNING.RECEPTION_PASS_SENSITIVITY;
  const servePenalty =
    serveQuality === 'in_play_good'
      ? 0
      : serveQuality === 'in_play_ok'
        ? TUNING.RECEPTION_SERVE_PENALTY
        : TUNING.RECEPTION_SERVE_PENALTY * 2;

  const perfect = clamp(TUNING.RECEPTION_PERFECT_BASE + passDelta - servePenalty);
  const good = clamp(TUNING.RECEPTION_GOOD_BASE + passDelta * 0.5 - servePenalty * 0.5);
  const ok = clamp(TUNING.RECEPTION_OK_BASE);
  const bad = clamp(1 - perfect - good - ok);
  return normalize({ perfect, good, ok, bad });
}

// ─────────────────────────────────────────────────────────────
// SET
// ─────────────────────────────────────────────────────────────

export type SetDist = Dist<'perfect' | 'good' | 'ok' | 'bad'>;
export type ReceptionGrade = 'perfect' | 'good' | 'ok' | 'bad';

export function setOutcome(setter: PlayerRatings, recGrade: ReceptionGrade): SetDist {
  const base =
    recGrade === 'perfect'
      ? TUNING.SET_PERFECT_FROM_PERFECT_RECEPTION
      : recGrade === 'good'
        ? TUNING.SET_PERFECT_FROM_GOOD_RECEPTION
        : recGrade === 'ok'
          ? TUNING.SET_PERFECT_FROM_OK_RECEPTION
          : TUNING.SET_PERFECT_FROM_BAD_RECEPTION;
  const ratingDelta = (setter.set - 50) * TUNING.SET_RATING_SENSITIVITY;
  const perfect = clamp(base + ratingDelta);
  const good = clamp((1 - perfect) * 0.55);
  const ok = clamp((1 - perfect - good) * 0.7);
  const bad = clamp(1 - perfect - good - ok);
  return normalize({ perfect, good, ok, bad });
}

// ─────────────────────────────────────────────────────────────
// ATTACK
// ─────────────────────────────────────────────────────────────

export type AttackDist = Dist<'kill' | 'error' | 'blocked' | 'dug'>;
export type SetQuality = 'perfect' | 'good' | 'ok' | 'bad';

export function attackOutcome(
  attacker: PlayerRatings,
  blocker: PlayerRatings,
  setQuality: SetQuality,
  momentumBias = 0,
): AttackDist {
  const kill = clamp(
    TUNING.ATTACK_KILL_BASE +
      TUNING.ATTACK_KILL_PER_ATTACKER * (attacker.attack - 50) +
      TUNING.ATTACK_KILL_PER_BLOCKER * (blocker.block - 50) +
      TUNING.SET_QUALITY_KILL_BONUS[setQuality] +
      momentumBias,
  );
  const err = clamp(
    TUNING.ATTACK_ERROR_BASE + TUNING.ATTACK_ERROR_PER_ATTACKER * (attacker.attack - 50),
  );
  const blocked = clamp(
    TUNING.ATTACK_BLOCKED_BASE + TUNING.ATTACK_BLOCKED_PER_BLOCKER * (blocker.block - 50),
  );
  const dug = clamp(1 - kill - err - blocked);
  return normalize({ kill, error: err, blocked, dug });
}

// ─────────────────────────────────────────────────────────────
// DIG
// ─────────────────────────────────────────────────────────────

export type DigDist = Dist<'kept' | 'dropped'>;

export function digOutcome(digger: PlayerRatings): DigDist {
  const kept = clamp(TUNING.DIG_KEPT_BASE + TUNING.DIG_PER_RATING * (digger.dig - 50));
  return normalize({ kept, dropped: 1 - kept });
}

// ─────────────────────────────────────────────────────────────
// sampling helper
// ─────────────────────────────────────────────────────────────

export function sample<K extends string>(d: Dist<K>, u01: number): K {
  let acc = 0;
  const keys = Object.keys(d) as K[];
  for (const k of keys) {
    acc += d[k];
    if (u01 < acc) return k;
  }
  return keys[keys.length - 1]!; // numerical safety
}
