# Recruiting Screen Redesign v2 (Sprint 28 Task 28.5)

**Status:** Draft for user review (Matt) before Phase B implementation.
**Date authored:** 2026-05-03
**Source of inspiration:** Football Coach: College Dynasty (FCCD).
**License note:** Personal-use project (CLAUDE.md §1) — patterns and layouts may be mirrored from FCCD freely. Asset files (PNGs, fonts, audio) and verbatim copy strings are not redistributed.

---

## 1. Goal

Replace the current `RecruitingBoard.tsx` (Sprint 21 hook-based table) with an FCCD-grade recruiting workflow that surfaces:

- Where the user stands relative to other suitors at every recruit.
- A clear weekly action budget the user spends on visits / calls / scholarships / scouting.
- Recruit-by-recruit detail (scouting status, region, leader, projected commit window).
- Team needs that the user should be filling.
- Commit / decline events as they fire during the weekly tick.

The current screen is a flat sortable table. It does not surface action affordances, interest meters, or team needs. Users have to mentally model "is this recruit close to committing? to whom?" without UI support. This redesign moves toward FCCD's split-pane "list + detail" pattern.

---

## 2. Layout

```
┌─ Recruiting (Week N of M) ─────────────────────────────────────┐
│ [Weekly action budget bar: 18 / 20 points]   [Team needs: 3]  │
├──────────────────────────────────────────────────────────────────┤
│ ┌─ Recruit list ──────────────────┐  ┌─ Detail pane ─────────┐ │
│ │ Filters: pos | stars | region   │  │ JANE SMITH            │ │
│ │ Sort:    interest desc          │  │ OH · ★★★★ · CA        │ │
│ │ ┌──┬─────┬───┬────┬───┬───────┐ │  │ Hometown: San Diego   │ │
│ │ │# │Name │Pos│★★★★│Reg│Leader │ │  │                       │ │
│ │ │1 │Smith│OH │ 4  │CA │USC    │ │  │ ┌─ Interest meter ─┐  │ │
│ │ │2 │Jones│MB │ 5  │TX │UT     │ │  │ │ STAN: ████████░  │  │ │
│ │ │3 │Park │S  │ 4  │WA │ —     │ │  │ │ USC:  ██████░░░  │  │ │
│ │ └──┴─────┴───┴────┴───┴───────┘ │  │ │ UCLA: █████░░░░  │  │ │
│ │                                 │  │ │ ASU:  ██░░░░░░░  │  │ │
│ │                                 │  │ └──────────────────┘  │ │
│ │                                 │  │                       │ │
│ │                                 │  │ ┌─ Actions ────────┐  │ │
│ │                                 │  │ │ [Scout]  3 pts   │  │ │
│ │                                 │  │ │ [Call]   2 pts   │  │ │
│ │                                 │  │ │ [Visit]  5 pts   │  │ │
│ │                                 │  │ │ [Offer Schol] 0p │  │ │
│ │                                 │  │ └──────────────────┘  │ │
│ │                                 │  │                       │ │
│ │                                 │  │ Scouting: 2/3 ratings │ │
│ │                                 │  │ revealed              │ │
│ └─────────────────────────────────┘  └───────────────────────┘ │
│                                                                 │
│ ┌─ Team needs ─────────────────────────────────────────────┐   │
│ │ S × 2 graduating · MB × 1 graduating · L × 0 [filled]    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─ This week's events ─────────────────────────────────────┐   │
│ │ • Smith committed to USC                                  │   │
│ │ • Park is now leaning STAN                                │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ [Advance Week]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Components (new)

### 3.1 `WeeklyActionBudget.tsx`
- Renders a horizontal points bar showing "spent / total".
- Resets on each weekly tick (`recruitingWeek` increments).
- Disables action buttons in the detail pane when remaining points are insufficient.
- Total points scale with HC `ratingRecruit` (better recruiter = more weekly bandwidth). Reuse Sprint 13 logic.

### 3.2 `RecruitDetailPane.tsx`
- Visible when a row is selected. Empty-state when no selection.
- Sections:
  - Bio (name, pos, height, hometown, stars).
  - **Interest meter** (`InterestMeter.tsx` sub-component) — bar per competing team, your team highlighted.
  - **Actions** — buttons keyed to the 4 weekly actions. Each shows cost in budget points and a tooltip explaining the effect on interest gain.
  - **Scouting status** — N/3 ratings revealed; clicking "Scout" reveals one more (deterministic per recruit + week).
  - **Projected commit window** — text estimate ("late October") based on recruit's commit timer.

### 3.3 `InterestMeter.tsx`
- Stacked horizontal bars, one per competing team, top-5 by interest value.
- Each bar shows team abbreviation + numeric interest score (0-100).
- User's team highlighted with `--accent` color.
- Used in detail pane and (compact form) inside the recruit list row.

### 3.4 `TeamNeedsCard.tsx`
- Computed from the user's current roster:
  - Position thinness: count graduating seniors per position.
  - Recommended targets: positions with N≥1 graduating senior or where the rank-2 player's overall is <70.
- Renders inline above the recruit list.

### 3.5 `WeeklyEventsLog.tsx`
- Surfaces commits, decommits, lean changes for the most recent week.
- Pulled from new `Notification` rows or computed by diffing pre/post-advance state.

### 3.6 Modifications to existing components
- `RecruitingBoard.tsx` becomes the page shell that lays out the above. Most of the table-rendering logic moves into a new `RecruitListPane.tsx` to keep concerns split.

---

## 4. IPC additions

| Channel | Purpose |
|---|---|
| `recruiting.teamNeeds(teamId)` | Returns `{ position: string; graduatingCount: number; thinness: number }[]` for the user's team. Computed on read. |
| `recruiting.weeklyActions(slotId, teamId)` | Returns `{ pointsAvailable: number; pointsSpent: number }`. |
| `recruiting.recruitDetail(slotId, recruitId)` | Returns the full recruit-detail view payload: bio + interests across all teams + scouting state + projected commit window. |
| `recruiting.weeklyEvents(slotId, sinceWeek)` | Returns events fired during the most recent advance: commits, decommits, lean changes. |

These are additive — existing IPC channels (open, action, advance, close, state) stay as-is.

---

## 5. Data model additions (deferred decision)

To track points spent per week per team, we can either:

- **Option A (preferred):** add a denormalized `RecruitingWeekState` table with `(teamId, weekIndex, pointsSpent)`. Resets at offseason.
- **Option B:** compute on-the-fly from `RecruitingAction` history (assumes such a log exists).

Resolve in Phase B based on whether `RecruitingAction` history is queryable.

---

## 6. Open questions for user review

1. **FCCD reference accuracy.** I don't have visual access to FCCD's recruiting screen — the layout above is reconstructed from general FCCD-recruiting patterns and the user's described preferences. **User should confirm which FCCD elements are present that I've missed**, e.g.:
   - Is there a "show only my targets" toggle in FCCD?
   - How does FCCD surface "the recruit is going to commit soon" — countdown timer? warning banner?
   - Does FCCD have a "scout report card" view per recruit, or is scouting purely interest-meter unlocking?
2. **Action types.** I've assumed 4 actions: Scout / Call / Visit / Offer Scholarship. FCCD may have more (Camp Invite, Coach Meeting, etc.). User should enumerate.
3. **Budget points scale.** Default proposal: 20 base + (HC.ratingRecruit / 10). User can supply FCCD's actual scaling.
4. **Visual aesthetic.** No FCCD screenshots in this repo. User should provide screenshots for reference (or describe color/typography preferences) before Phase B.

---

## 7. Phase B implementation plan

Once user signs off on this doc:

1. Add new IPC channels and handlers (~3 hr).
2. Build sub-components in order: WeeklyActionBudget → InterestMeter → RecruitDetailPane → TeamNeedsCard → WeeklyEventsLog (~5 hr).
3. Restructure RecruitingBoard.tsx into the layout shell + RecruitListPane (~1.5 hr).
4. Update `useRecruitingStore.ts` to expose detail-pane state and action-budget state (~1 hr).
5. Component tests for each new component (~2 hr).
6. axe-clean check + integration smoke test (~1 hr).

**Estimate:** 13–14 hours of focused work. This makes Phase B a sprint of its own.

---

## 8. What this doc does NOT decide

- Scouting probability tuning (existing model preserved).
- Interest-gain formulas per action type (existing model preserved).
- Team-AI behavior (no changes — AI continues to use existing scoring).
- Signing day mechanics (existing flow preserved).

---

## 9.1 Screenshot review (2026-05-03)

User added FCCD screenshots to `docs/screenshots/`. Reviewed and revised plan:

**FCCD's recruiting screen has FOUR resource pools**, not one:
1. **Recruiting actions remaining** (week-tick budget for pitches/visits/calls).
2. **Scouts remaining** (separate season-pool, `10/10` shown).
3. **Pitches per coach** (HC/OC/DC each get separate weekly pitch slots).
4. **NIL Money Remaining** (season-cumulative, drawn from booster collective).

**Plus season-cumulative caps:** Recruit Targets (33/40), Commitments (0/25), Offers Used (22/50), Coach Integrity (74).

**Tabs in main screen:** `All Recruits | My Targets | My Commits | Outstanding Offers | Roster`. Plus a "Targets by position" panel showing per-position offer/pitch counts.

**Recruit detail modal has 5 sub-tabs:**
- **Recruiting Battle** — interest meter w/ point deltas vs. leader, last-week-action per team, offer/visit/NIL columns.
- **Recruit Visits** — scheduled visit calendar.
- **Recruit Priorities** — factor matrix (Playing time, Scheme fit, Proximity, Prestige, Atmosphere, Facilities, College life, Academics, NIL, Bonuses) × competing schools, with letter-grade per cell + recruit's importance bar per row.
- **Scouting** — full numeric ratings table organized by skill group (Athleticism, Ball Skills, Defense, etc.), with arrows showing if scouting moved the rating up/down vs. initial. Top 3 cards: OVERALL, POTENTIAL, DURABILITY (mixed letter+numeric).
- **Career** — high-school stats / past combine results.

**My Targets list view per row:**
- Position + archetype (e.g., "OH · Pin Hitter")
- Priority # (drag-reorderable)
- Bio (height, hometown), ranking (#286 Overall, #35 OH)
- Ratings: stars, OVR, POT, with letter-grade indicators
- Recruitment column: top-5 competing schools as logos with point delta vs. leader
- Action column: Details / Remove / Scout (count) / Target / Pitch (HC/AHC/AC pill)
- Has Offer / NIL deal status badges

## 9.2 v1.0 scope decision (Phase B)

Given the depth of the FCCD model, Phase B will deliver a **structurally faithful subset** and defer some features to v1.2:

**Phase B IN SCOPE (deliver now):**
- Top stats strip showing 4 pools + cumulative caps (no Coach Integrity for v1.0).
- 3 tabs: All Recruits / My Targets / My Commits (defer Outstanding Offers + Roster duplication).
- Detail modal with 2 sub-tabs: Battle + Scouting (defer Visits / Priorities / Career).
- Scouting tab uses scoutLevel-keyed reveals (0=letters, 3=numerics; Q3 simplified to letter-only at all levels for v1.0; numeric at 100% in v1.2).
- 5 actions wired up (already done in IPC layer).
- Per-coach pitch budget visualization in budget strip.

**Phase B DEFERRED to v1.2:**
- Recruit Priorities matrix tab (factor × school grid).
- Recruit Visits scheduling.
- Career tab.
- "Targets by position" cards panel.
- Outstanding Offers tab.
- Recommended targets / auto-recruit toggle.
- NIL deal UI in detail modal (data plumbing exists via Sprint 15 booster).

This subset still gives the user the FCCD recruiting RHYTHM (target → scout → pitch → battle → commit) without the 13–14 hours becoming 30+.

---

## 9.3 Interest model — FCCD "Recruit Priorities" mapping

User flagged (post-deploy): playing as Davidson (prestige 45) showed a board full of 5-star recruits with non-trivial interest. Unrealistic. The pre-fix model multiplied prestige by a flat weight (4) and was star-agnostic, so a 5-star and a 1-star scored almost identically against any team.

**Fix (Sprint 28 in-flight):** rewrite `computeBaseInterest` so the interest signal mirrors the FCCD "Recruit Priorities" tab in spirit. Each FCCD factor maps to existing VCD data:

| FCCD factor (Recruit Priorities tab) | VCD source | Term in `computeBaseInterest` |
|---|---|---|
| **School prestige** | `Team.prestige` × recruit `stars` | `prestige × stars × PRESTIGE_STAR_WEIGHT` (dominant) |
| **Proximity to home** | `Team.region == Recruit.hometownRegion` | `+REGION_BONUS` (40) on match |
| **Coach reputation** | `Coach.ratingRecruit` (HC) | `(coachRecruit − 50) × COACH_DIFF_WEIGHT` (0.5) |
| **Playing time** | commits at recruit's position | `−COMMIT_SATURATION_PER_COMMIT × commitsAtPosition` |
| **Star/program-tier fit** | new — star floor ladder | `−(STAR_FLOOR[stars] − prestige) × 12` if prestige below floor |
| **Scheme fit, atmosphere, facilities, academics, college life, NIL deal** | (deferred — needs new team props or maps to existing booster budget) | not yet in formula |

**Star-prestige floor** (the new piece that fixes Davidson):

```
STAR_PRESTIGE_FLOOR = { 5: 70, 4: 50, 3: 30, 2: 15, 1: 0 }
```

A team's prestige below the recruit's star floor pays 12 points per gap-prestige-point. Examples (no region bonus, neutral coach):
- Stanford (95) + 5-star: `95×5 + 0 = 475` ✓ blueblood pursues
- Penn State (85) + 5-star: `85×5 + 0 = 425` ✓ pursues
- Iowa (60) + 5-star: floor 70, gap 10, penalty 120; `60×5 − 120 = 180` ✓ has a shot
- Davidson (45) + 5-star: floor 70, gap 25, penalty 300; `45×5 − 300 = −75 → 0` ✗ not in the race
- Davidson (45) + 4-star: floor 50, gap 5, penalty 60; `45×4 − 60 = 120` ✓ realistic
- Davidson (45) + 3-star: floor 30, no penalty; `45×3 = 135` ✓ comfortable bracket
- Davidson (45) + 3-star + region match: `135 + 40 = 175` ✓ regional pull helps
- Low-major (25) + 4-star: floor 50, gap 25, penalty 300; `25×4 − 300 = −200 → 0` ✗ not in the race
- Low-major (25) + 2-star: floor 15, no penalty; `25×2 = 50` ✓ visible

**Board ranking** (`computeBoardScore`) keeps a small star bonus (25, down from 80) for tiebreaks plus the deterministic per-(team, recruit) jitter introduced in Sprint 25 — but the prestige × stars term in `computeBaseInterest` is now what does the heavy lifting on tier separation, so the bonus doesn't have to override the prestige model.

**v1.2 plan**: add columns to the `Team` model for `facilitiesRating`, `academicsRating`, `collegeLifeRating`, `stadiumAtmosphereRating` (each 0–100), seeded deterministically from prestige with per-school noise. Recruits get a `prioritiesJson` weighting these factors. Score becomes a true weighted sum. The Recruit Priorities tab in the detail modal then renders the per-(team, factor) letter grid the user saw in FCCD.

---

## 9.4 Sign-off block

User reviewed this doc on: 2026-05-03
Approved with the following decisions (Sprint 28 Phase B):

- **Q1 commit signaling:** D — no timer/banner. User infers from interest meter alone.
- **Q2 list filtering:** A — single list with a "show only my targets" toggle that filters to recruits the user has acted on.
- **Q3 scouting model:** B — each "Scout" action reveals a scout-report letter grade (A–F) per skill rather than the underlying numeric rating.
- **Q4 weekly actions:** Scout, Phone Call, Home Visit, Offer Scholarship, Camp Invite (5 total).
- **Q5 budget points:** D — base from HC + bonus from AHC + bonus from AC. Empty assistant slots reduce the pool.
- **Q6 detail layout:** B — modal (not split-pane).
- **Q7 aesthetic:** B — match FCCD recruiting screen exactly. Screenshots pending; Phase B builds a reasonable approximation that user iterates on after seeing live UI.
