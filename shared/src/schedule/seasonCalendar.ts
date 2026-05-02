// 2026 NCAA D-I Women's Volleyball calendar, simplified:
//   - Season start (week 0, Fri): 2026-08-28
//   - 14 weeks, each with 3 match dates (Fri, Sat, Sun)
//   - Total: 42 possible dates
//
// Week numbering: 0 = pre-season, 1–2 = early non-conf, 3–13 = conf heavy
// (matches per the plan's date-assignment algorithm).

export type CalendarDate = {
  weekIndex: number; // 0..13
  isoDate: string; // 'YYYY-MM-DD'
  dayOfWeek: 'Fri' | 'Sat' | 'Sun';
};

export type SeasonCalendar = {
  seasonYear: number;
  weeks: Array<{
    weekIndex: number;
    dates: CalendarDate[];
  }>;
};

const DAY_MS = 86_400_000;

/**
 * NCAA D-I women's volleyball regular season anchors on a late-August
 * Friday and runs 14 Fri/Sat/Sun weeks. We pick the first Friday on or
 * after August 28 of the requested year as week-0 anchor (2026 lands
 * exactly on 8/28; other years shift 0–6 days).
 *
 * Sprint 23: extended to support arbitrary years for the multi-season
 * dynasty test. Sprint 7's hard-coded 2026 was a temporary scope guard.
 */
export function buildSeasonCalendar(seasonYear = 2026): SeasonCalendar {
  const startMs = firstFridayOnOrAfter(seasonYear, 7, 28); // Aug 28 (month 7 = August, 0-indexed)
  const weeks: SeasonCalendar['weeks'] = [];
  for (let w = 0; w < 14; w++) {
    const base = startMs + w * 7 * DAY_MS;
    const dates: CalendarDate[] = [
      { weekIndex: w, isoDate: isoDate(base), dayOfWeek: 'Fri' },
      { weekIndex: w, isoDate: isoDate(base + DAY_MS), dayOfWeek: 'Sat' },
      { weekIndex: w, isoDate: isoDate(base + 2 * DAY_MS), dayOfWeek: 'Sun' },
    ];
    weeks.push({ weekIndex: w, dates });
  }
  return { seasonYear, weeks };
}

function firstFridayOnOrAfter(year: number, monthIdx: number, day: number): number {
  const ms = Date.UTC(year, monthIdx, day);
  const dow = new Date(ms).getUTCDay(); // 0 = Sun, 5 = Fri
  const offsetDays = (5 - dow + 7) % 7;
  return ms + offsetDays * DAY_MS;
}

function isoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
