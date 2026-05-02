// Sprint 20 chart 5: rally-length distribution + point differential per
// bucket.
//
// Rally length = number of events in the rally. Buckets: 1-3 (quick),
// 4-6 (medium), 7-10 (long), 11-15 (extended), 16+ (extreme). For each
// bucket: total rally count + how many points each team won within that
// bucket (winningTeam).

import type { MatchPbp } from '../sim/pbp';
import type { RallyLengthBucket, RallyLengthBucketRow, RallyLengthData } from './types';
import { RALLY_LENGTH_BUCKETS } from './types';

function bucketize(length: number): RallyLengthBucket {
  if (length <= 3) return '1-3';
  if (length <= 6) return '4-6';
  if (length <= 10) return '7-10';
  if (length <= 15) return '11-15';
  return '16+';
}

export function computeRallyLengthDistribution(pbp: MatchPbp): RallyLengthData {
  const counts: Record<RallyLengthBucket, RallyLengthBucketRow> = {} as Record<
    RallyLengthBucket,
    RallyLengthBucketRow
  >;
  for (const b of RALLY_LENGTH_BUCKETS) {
    counts[b] = { bucket: b, count: 0, homePoints: 0, awayPoints: 0 };
  }

  for (const set of pbp.sets) {
    for (const rally of set.rallies) {
      const bucket = bucketize(rally.events.length);
      const row = counts[bucket];
      row.count += 1;
      if (rally.winningTeam === 'home') row.homePoints += 1;
      else row.awayPoints += 1;
    }
  }

  // Return in fixed bucket order.
  return RALLY_LENGTH_BUCKETS.map((b) => counts[b]);
}
