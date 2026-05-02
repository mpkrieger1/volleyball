import { z } from 'zod';

const rating = z.number().int().min(0).max(100);

export const PlayerRatingsSchema = z.object({
  attack: rating,
  block: rating,
  serve: rating,
  pass: rating,
  set: rating,
  dig: rating,
  athleticism: rating,
  iq: rating,
  stamina: rating,
});
export type PlayerRatings = z.infer<typeof PlayerRatingsSchema>;

/** Mean of selected rating keys, rounded to nearest int. */
export function avg(r: PlayerRatings, keys: ReadonlyArray<keyof PlayerRatings>): number {
  if (keys.length === 0) return 0;
  let sum = 0;
  for (const k of keys) sum += r[k];
  return Math.round(sum / keys.length);
}
