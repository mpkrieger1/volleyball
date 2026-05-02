// Small helper: mean of the 9 player ratings, used as "overall" in Sprint 14
// portal models.

export function ratingsAverage(p: {
  ratingAttack: number;
  ratingBlock: number;
  ratingServe: number;
  ratingPass: number;
  ratingSet: number;
  ratingDig: number;
  ratingAthleticism: number;
  ratingIq: number;
  ratingStamina: number;
}): number {
  return Math.round(
    (p.ratingAttack +
      p.ratingBlock +
      p.ratingServe +
      p.ratingPass +
      p.ratingSet +
      p.ratingDig +
      p.ratingAthleticism +
      p.ratingIq +
      p.ratingStamina) /
      9,
  );
}
