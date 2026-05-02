// Sprint 20 chart 4: serve location heat map (6-zone court).
//
// **Approximation**: ServeEvent has no targetZone field today. We use the
// receiver's slot (mapped via SLOT_TO_ZONE) as a proxy for "where the serve
// was received." For aces (no reception event) and errors, attribute to
// zone 0 ("ace/error pile") rather than a court zone.

import type { MatchPbp } from '../sim/pbp';
import type { ServeZoneHeatmapData, ServeZoneHeatmapCell } from './types';
import { SLOT_TO_ZONE } from './types';

type ZoneCounts = { count: number; aces: number; errors: number };

function emptyZones(): Record<number, ZoneCounts> {
  const out: Record<number, ZoneCounts> = {};
  for (let z = 0; z <= 6; z++) out[z] = { count: 0, aces: 0, errors: 0 };
  return out;
}

export function computeServeZoneHeatmap(pbp: MatchPbp): ServeZoneHeatmapData {
  const home = emptyZones();
  const away = emptyZones();

  for (const set of pbp.sets) {
    for (const rally of set.rallies) {
      for (let i = 0; i < rally.events.length; i++) {
        const event = rally.events[i]!;
        if (event.kind !== 'serve') continue;

        const target = event.team === 'home' ? home : away;
        if (event.quality === 'ace') {
          target[0]!.aces += 1;
          target[0]!.count += 1;
        } else if (event.quality === 'error') {
          target[0]!.errors += 1;
          target[0]!.count += 1;
        } else {
          // in_play: peek at the next event for receiver slot.
          const next = rally.events[i + 1];
          if (next && next.kind === 'reception') {
            const slot = next.receiver as 0 | 1 | 2 | 3 | 4 | 5;
            const zone = SLOT_TO_ZONE[slot];
            target[zone]!.count += 1;
          } else {
            // No reception event followed (defensive guard); attribute to zone 0.
            target[0]!.count += 1;
          }
        }
      }
    }
  }

  const cells: ServeZoneHeatmapCell[] = [];
  for (let z = 0; z <= 6; z++) {
    const zone = z as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    cells.push({ servingTeam: 'home', zone, ...home[z]! });
    cells.push({ servingTeam: 'away', zone, ...away[z]! });
  }
  return cells;
}
