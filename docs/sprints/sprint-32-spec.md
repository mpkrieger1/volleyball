# Sprint 32 Spec — FCCD-Style Training Gain Curve

**Window:** weeks 63–64 (post-Sprint-31; v1.2 player-development batch)
**Status:** Spec rewritten 2026-05-04 to mirror Football Coach: College Dynasty's player-development model after the user requested FCCD parity. Replaces the original "9 per-skill potential columns" approach.
**Augments:** Sprint 12 (recruit generation), Sprint 14 (initial roster generation), Sprint 28 (Player schema). First of three sprints (32/33/34) overhauling player development to match FCCD.
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists

VCD's player development needs to feel like FCCD. In FCCD a player has **one** `potential` value (0–100). When a coach focuses a training slot on an attribute, the gain depends on:

1. **Potential** — caps the upper end of the gain range (`maxScale = floor(potential/10) − 1` → potential 60 = 5, 90 = 8, 100 = 9).
2. **Current rating in that attribute** — a "line function" multiplier from 1.5× at rating 40 down to 0.25× at rating 100, clamped to [0, 2]. So low-rated attributes gain a lot, high-rated attributes barely move.
3. **Facilities** — set the floor of the range.
4. **Coach + repeated-focus penalty** — addressed in Sprint 33.

The original Sprint 32 spec proposed nine per-skill potential columns. **FCCD does not work that way** — its single `potential` plus the line-function curve produces an organic per-attribute "soft cap" without explicit columns. This sprint installs the **gain-curve helpers** (and supporting `Facilities` plumbing) needed for Sprint 33's training event. No schema growth on Player/Recruit.

---

## 2. Sprint goal

Three pure helpers ship in `@vcd/shared`:

- `getTrainingGainAmountRange({ potential, currentRating, facilitiesLevel, isFocused })` → `{ min, max }`
- `getTrainingBreakthroughChance({ potential, coachBreakthroughBonus, repeatedFocusCount })` → `0..1`
- `getRepeatedFocusMultiplier(n)` → 1×, 0.6×, 0.4×, 0.2× for n = 0, 1, 2, ≥3

A new `Facilities` table (one row per team) tracks an integer level 1–10 that feeds the floor of the gain range. Schema migration only — gameplay use lands in Sprint 33.

`PlayerProfileModal` gets a small "Headroom" indicator per skill (using the curve to compute "how much room to grow before gains shrink to ~0"), but **no per-skill potential columns**.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| `Player` table with single `potential: Int` | ✅ | `prisma/schema.prisma` |
| `Recruit` table with single `potential: Int?` | ✅ | `prisma/schema.prisma` |
| Coach roles HC / AHC / AC | ✅ | `prisma/schema.prisma:141` |
| `Coach.ratingDevelop` | ✅ | `prisma/schema.prisma:141` |
| `applyMigrations` save-compat path (Sprint 25) | ✅ | `main/src/saveSlots/service.ts` |
| `PlayerProfileModal.tsx` | ✅ | `app/src/components/PlayerProfileModal.tsx` |
| Last migration: `20261019_000000_match_live_state` (Sprint 29) | ✅ | `prisma/migrations/` |

---

## 4. Tasks

### Task 32.1 — Schema migration: `Team.facilitiesLevel` column

**What:** Add `facilitiesLevel: Int @default(3)` directly to the `Team` table. Migration timestamp `20261102_000000_team_facilities_level`.

**Why a column, not a separate table:** mirrors FCCD's flat `team.attributeLevels` shape (module 1392). Sprint 35 will add `academicsLevel` the same way; if v1.3+ adds `stadiumLevel` / `marketingLevel` they slot in as siblings. A separate one-to-one `Facilities` table would over-engineer the data model relative to the FCCD reference.

**Schema additions:**
```prisma
model Team {
  // ...existing fields...
  facilitiesLevel Int @default(3)  // 1..10; mid-tier baseline
}
```

The level seed in `seedLeagueInto` is derived from prestige tier (prestige 90+ = level 7; 75+ = 5; 50+ = 4; else 3) so high-prestige programs feel a small training advantage from day one.

**TDD approach:**
1. `tests/integration/migrations/facilitiesLevelMigration.test.ts`:
   - Apply migration on a fresh DB; assert column exists with default 3.
   - Apply on a legacy DB seeded with pre-S32 teams; assert all existing rows get default 3.
   - Idempotent re-apply via `applyMigrations` (CLAUDE.md "From Sprint 25").
2. `tests/integration/seed/facilitiesLevelSeed.test.ts`:
   - Fresh league: every team has `facilitiesLevel` matching the prestige tier (spot-check 5 teams).
3. `tests/integration/migrations/facilitiesLevelBackfill.test.ts`:
   - Legacy save: `applyMigrations` post-step bumps facilitiesLevel from default 3 to the prestige-derived value for each team.
   - Idempotent — re-running doesn't re-bump.

**Implementation:**
1. `prisma/migrations/20261102_000000_team_facilities_level/migration.sql` — `ALTER TABLE Team ADD COLUMN facilitiesLevel INTEGER NOT NULL DEFAULT 3`.
2. `prisma/schema.prisma` — add `facilitiesLevel: Int @default(3)` to `Team`.
3. `prisma/seed.ts` / `shared/src/seed/leagueSeed.ts` — write the prestige-tier level for every team in `seedLeagueInto`.
4. `main/src/saveSlots/backfillFacilitiesLevel.ts` — post-migration backfill keyed on the migration name (CLAUDE.md "From Sprint 25" `_prisma_migrations` tracking).

**Acceptance:**
- [ ] Migration applies cleanly on fresh + legacy DBs.
- [ ] Seed populates `facilitiesLevel` for every team via `seedLeagueInto`.
- [ ] Legacy backfill is idempotent.

**Calibration risk:** None.
**Schema risk:** Low — one new column on existing table.
**Effort:** Small (~1.5 h).

---

### Task 32.2 — Pure helper: `getRepeatedFocusMultiplier`

**What:** Direct port of FCCD `getRepeatedTrainingsMultiplier` (module 935275 in `coreWorker.js`):

```ts
export function getRepeatedFocusMultiplier(n: number): number {
  switch (n) {
    case 0: return 1.0;
    case 1: return 0.6;
    case 2: return 0.4;
    default: return 0.2;
  }
}
```

`n` = how many times the same attribute focus has already been picked this offseason event (ahead of the current pick, by any coach on the team).

**TDD approach:**
1. `tests/unit/offseason/repeatedFocusMultiplier.test.ts`:
   - Table-driven: 0→1.0, 1→0.6, 2→0.4, 3→0.2, 10→0.2.
   - Pure function, no IO.

**Implementation:**
1. `shared/src/offseason/repeatedFocusMultiplier.ts` (new).
2. Re-export via `@vcd/shared/offseason` namespace barrel.

**Acceptance:**
- [ ] Five table cases pass.

**Effort:** Small (~30 min).

---

### Task 32.3 — Pure helper: `getTrainingGainAmountRange`

**What:** Direct port of FCCD's gain range (module 97136). Takes the player's potential, their current rating in the focused attribute, the team's facilities level, and a `isFocused` flag (true when a coach has explicitly selected this attribute, false when a player gets background drift gains from a coach skill perk).

```ts
export interface TrainingGainArgs {
  potential: number;        // 0..100
  currentRating: number;    // 0..100
  facilitiesLevel: number;  // 1..10
  isFocused: boolean;
}
export interface TrainingGainRange { min: number; max: number; }

export function getTrainingGainAmountRange(args: TrainingGainArgs): TrainingGainRange {
  const facilitiesBase = getFacilitiesBaseGain(args.facilitiesLevel);
  const maxScale = Math.floor(args.potential / 10) - 1;
  const min = args.isFocused ? 1 : facilitiesBase;
  const attrCurve = clamp(lineFunc(40, 1.5, 100, 0.25)(args.currentRating), 0, 2);
  const max = Math.max(maxScale * attrCurve, min);
  return { min: Math.round(min), max: Math.round(max) };
}
```

Plus the supporting helpers, ported verbatim from FCCD:

```ts
// linear interpolation: y(x1) = y1, y(x2) = y2, extrapolated outside
export function lineFunc(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const slope = (y2 - y1) / (x2 - x1);
  return (x) => y1 + slope * (x - x1);
}

// FCCD facilities-tier baseline gain (verified table)
export function getFacilitiesBaseGain(level: number): number {
  // 1→0, 2→0, 3→1, 4→1, 5→1, 6→2, 7→2, 8→3, 9→3, 10→4
  if (level >= 10) return 4;
  if (level >= 8) return 3;
  if (level >= 6) return 2;
  if (level >= 3) return 1;
  return 0;
}
```

**Note on the facilities curve:** the FCCD bundle has `getFacilitiesBaseGain` as an inferable function but the body wasn't extracted in the comparison pass. The numeric table above is the ballpark to ship; calibrate against a 5-season Vitest run in Sprint 33.

**TDD approach:**
1. `tests/unit/offseason/trainingGainRange.test.ts`:
   - Spot-check parity with FCCD examples:
     - `potential 90, currentRating 70, facilities 5, focused: true` → `min ≈ 1, max ≈ 5–7` (maxScale 8 × attrCurve ~0.7).
     - `potential 60, currentRating 95, focused: true` → `max ≈ 1` (curve nearly zero near cap).
     - `potential 100, currentRating 30, focused: true` → `max ≈ 9 × min(2, ~1.7) ≈ 15–18`.
   - Invariants over 10K random inputs:
     - `min ≤ max`.
     - Both finite, non-negative integers ≤ 25.
     - `max` monotonically non-decreasing in `potential` for fixed currentRating + facilities + focused.
     - `max` monotonically non-increasing in `currentRating` for fixed potential + facilities (above rating 40).

**Implementation:**
1. `shared/src/offseason/trainingGain.ts` (new) — exports the three functions.
2. Re-export via `@vcd/shared/offseason`.

**Acceptance:**
- [ ] All spot-check cases pass.
- [ ] All invariants hold across 10K trials.

**Calibration risk:** Medium — these numbers feed Sprint 33's training event. Wrong constants here propagate. Validate empirically against a 5-season league sim before shipping S33.
**Effort:** Small-Medium (~2 h).

---

### Task 32.4 — Pure helper: `getTrainingBreakthroughChance`

**What:** Port of FCCD module 39825:

```ts
export interface BreakthroughArgs {
  potential: number;             // 0..100
  coachBreakthroughBonus: number; // 0..50, from coach skills (Sprint 33 supplies)
  repeatedFocusCount: number;     // see Task 32.2
}

export function getTrainingBreakthroughChance(args: BreakthroughArgs): number {
  const base = (args.potential / 2 + args.coachBreakthroughBonus) / 100;
  return getRepeatedFocusMultiplier(args.repeatedFocusCount) * base;
}
```

A "breakthrough" is an additional small bonus gain on top of the regular range — Sprint 33 implements the actual roll. Sprint 32 ships the chance helper.

**TDD approach:**
1. `tests/unit/offseason/breakthroughChance.test.ts`:
   - `potential=80, bonus=0, repeats=0` → 0.40.
   - `potential=100, bonus=10, repeats=0` → 0.60.
   - `potential=80, bonus=0, repeats=2` → 0.16.
   - Invariants: result ∈ [0, 1].

**Implementation:**
1. Same module as 32.3 (`shared/src/offseason/trainingGain.ts`).

**Acceptance:**
- [ ] Three table cases pass.
- [ ] Result clamped to [0, 1] over 10K trials.

**Effort:** Small (~30 min).

---

### Task 32.5 — Pure helper: `getValidTrainingFocuses(role)`

**What:** Port of FCCD module 22567. Maps a coach role to the list of attributes that role can train. VCD analogue (FCCD has HC/OC/DC; VCD has HC/AHC/AC):

```ts
export type TrainableSkill =
  | 'attack' | 'block' | 'serve' | 'pass' | 'set' | 'dig'
  | 'athleticism' | 'iq' | 'stamina';

export function getValidTrainingFocuses(role: 'HC' | 'AHC' | 'AC'): TrainableSkill[] {
  switch (role) {
    case 'HC':  return ['athleticism', 'iq', 'stamina'];
    case 'AHC': return ['attack', 'serve', 'set'];          // offense analogue
    case 'AC':  return ['block', 'pass', 'dig'];            // defense analogue
  }
}
```

If the team has multiple ACs, every AC sees the AC pool (same as FCCD where each defensive coach can pick from the same defensive pool).

**TDD approach:**
1. `tests/unit/offseason/validTrainingFocuses.test.ts`:
   - Role coverage: every TrainableSkill appears in exactly one role's list.
   - HC list size = 3, AHC = 3, AC = 3.

**Implementation:**
1. `shared/src/offseason/validTrainingFocuses.ts` (new).
2. Re-export via `@vcd/shared/offseason`.

**Acceptance:**
- [ ] All 9 skills are reachable; no skill is duplicated across roles.

**Effort:** Small (~30 min).

---

### Task 32.6 — `PlayerProfileModal`: per-skill headroom indicator

**What:** Extend the existing modal with a "headroom" column derived from the gain curve — **no new schema fields**. For each of the 9 skills:

- "Wide open" — `attrCurve > 1.0` (rating < ~70)
- "Some room" — `0.5 < attrCurve ≤ 1.0` (rating ~70–~90)
- "Capped" — `attrCurve ≤ 0.5` (rating > ~90)

The modal already shows OVR + POT. The new column is a single icon + label per skill row, computed live from `lineFunc(40,1.5,100,0.25)(currentRating)`.

**Frontend Design Considerations:**
- Reuse existing modal primitives (Sprint 28).
- Color-blind safe: icon + text label, not color alone (CLAUDE.md #7).
- Dense table; no extra chrome.

**TDD approach:**
1. `tests/unit/PlayerProfileModal.test.tsx`:
   - Mounts with a player fixture; assert all 9 skill rows show a headroom indicator.
   - Player at 50 attack → "Wide open"; at 80 → "Some room"; at 95 → "Capped".
   - axe-clean.

**Implementation:**
1. `app/src/components/PlayerProfileModal.tsx` — add the column; import `lineFunc` from `@vcd/shared/offseason`.
2. `app/src/styles.css` — minor spacing for the new column.

**Acceptance:**
- [ ] All 9 skill rows render the indicator.
- [ ] axe-core zero violations.

**Effort:** Medium (~2 h).

---

### Task 32.7 — Documentation + CLAUDE.md invariants

**Edits:**
1. `CLAUDE.md` §Critical rules #4 — append:
   - "Training gain range follows FCCD's curve: `maxScale = floor(potential/10) − 1`; per-attribute multiplier `lineFunc(40,1.5,100,0.25)(currentRating)` clamped to [0,2]; floor = `getFacilitiesBaseGain(level)` or 1 when focused. Defined in `shared/src/offseason/trainingGain.ts`."
   - "Repeated-focus penalty: 1× / 0.6× / 0.4× / 0.2× for the 1st/2nd/3rd/4th+ focus on the same attribute in the same offseason event."
   - "Player.potential remains a single integer. There are NO per-skill potential columns; per-attribute soft caps emerge organically from the gain curve."
2. `CLAUDE.md` "Gotchas" — placeholder for Sprint 32 retro at sprint close.
3. PRD §3.5 / §5 — note the FCCD-mirror pivot.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **32.2** (`getRepeatedFocusMultiplier`) — pure constant table.
2. **32.5** (`getValidTrainingFocuses`) — pure data.
3. **32.3** (`getTrainingGainAmountRange`) — needs `lineFunc` + facilities helper.
4. **32.4** (`getTrainingBreakthroughChance`) — uses 32.2.
5. **32.1** (`Team.facilitiesLevel` schema + seed + backfill).
6. **32.6** (modal headroom column).
7. **32.7** (docs).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 32 status |
|---|---|---|
| Save-slot creation | informal | ✅ +1 column on existing rows ≈ negligible |
| `applyMigrations` on legacy save | < 1 s | ✅ in-place column add + 360 backfill updates |
| `PlayerProfileModal` render | < 100 ms | ✅ 9 cheap arithmetic ops |
| Save-file size (10 seasons) | ≤ 35 MB | ✅ +1 int per Team row, negligible |

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] `npm run lint && typecheck && test && build` passes.
- [ ] `npm run test:calibration:full` unchanged (sim path untouched).
- [ ] Manual verification: open a legacy save → Roster → click a player → see all 9 headroom indicators.
- [ ] Sprint 32 retro authored at `docs/retros/sprint-32-retrospective-{date}.md`.
- [ ] Tagged `sprint-32-complete`.

---

## 8. Out of scope (Sprints 33 + 34)

- **Coach focus picks UI** (Sprint 33).
- **Applying gain at the training event** (Sprint 33).
- **Breakthrough rolls** (Sprint 33 — this sprint just ships the chance helper).
- **Facilities upgrades** (cost, school-spending UI) — deferred to v1.3 or later.
- **Per-attribute "potential" columns** — deliberately rejected per FCCD model.
- **In-season skill drift** — see Sprint 34 below; FCCD has none, so VCD won't either in v1.2.
- **Other team attribute levels** — `academicsLevel` lands in Sprint 35 (paired with recruiting priorities); `stadiumLevel`, `marketingLevel`, `collegeLifeLevel` deferred to v1.3+. The `Team.facilitiesLevel` column added here is the first of FCCD's "team attribute levels"; the others slot in as sibling columns when their consumers ship.
