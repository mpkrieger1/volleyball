# Sprint 33 Spec — FCCD-Style Offseason Calendar + Coach-Attribute Training

**Window:** weeks 65–66 (post-Sprint-32; v1.2 player-development batch continued)
**Status:** Spec rewritten 2026-05-04 to mirror Football Coach: College Dynasty's offseason and training-event flow. Replaces the original "5-week interactive offseason with 3 player picks per week" approach.
**Augments:** Sprint 16 (`runOffseason`), Sprint 17 (coach lifecycle), Sprint 32 (training gain helpers). Second of three sprints (32/33/34) overhauling player development.
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists

VCD's offseason today is one button: `Run Offseason` ages, graduates, refreshes coaches, develops returners — all in one transaction. The user has zero agency.

FCCD's offseason is a **15-week event sequence** terminating in an `AdvanceYear` step. Then the **preseason** is another 7 weeks, with a single `PreseasonTrainingResults` ("Offseason Gains") week where all training gains land. Training picks are made by **coaches** choosing **attributes** (not by the user choosing players + skills); each coach has ~3 effort slots, gains apply once at the Training Results week.

Sprint 33 ports both pieces to VCD:

1. **Offseason event sequence** — break the single `runOffseason` into 11 discrete week-events the user advances through one at a time (some are decisions, most are auto). Recruiting moves into its own dedicated offseason weeks; it does NOT run during the regular season.
2. **Coach-attribute training event** — at the new `OFFSEASON_GAINS` week (volleyball analogue of FCCD's `PreseasonTrainingResults`), apply training picks: each coach (HC/AHC/AC) has 3 focus slots, each slot picks an attribute, gains apply to all eligible players for that attribute via the Sprint 32 curve.

The original Sprint 33 spec's "3 player picks × 5 weeks" model is **dropped**.

---

## 2. Sprint goal

After Sprint 33: end-of-NCAA → user lands in `OFFSEASON_YEAR_SUMMARY`. They click "Advance" through the 11 offseason events (some show a decision UI, most show a results screen + advance). Recruiting opens at its dedicated offseason weeks and closes at signing day. After `OFFSEASON_ADVANCE_YEAR`, the calendar moves into **preseason**: at `PRESEASON_TRAINING_FOCUS` the user picks attribute focuses for each of their coaches; clicking "Advance to Training Results" computes per-player gains via Sprint 32 helpers and shows the results screen. Two more preseason weeks (`PRESEASON_GAMEPLAN`, `PRESEASON_FINALIZE`) and the season starts. The single-click `Run Offseason` is gone; the existing finalize logic (age, graduate, refresh coach pool) is split across the offseason events that match its semantics.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 32 helpers (`trainingGain`, `repeatedFocusMultiplier`, `validTrainingFocuses`, `Facilities`) | ⚠️ Sprint 32 dependency | Sprint 32 spec |
| `runOffseason` (existing single-click logic) | ✅ | `main/src/offseason/runOffseason.ts` |
| `Coach.ratingDevelop` + `Coach.role` HC/AHC/AC | ✅ | `prisma/schema.prisma:141` |
| Auto-open recruiting after PORTAL closes (Sprint 31 retro) | ✅ — will be re-routed | `main/src/portal/closePortal.ts` |
| `Season.phase` enum has `OFFSEASON`, `RECRUITING`, `PRESEASON` | ✅ | schema |
| Recruiting cycle structure | ✅ | Sprint 13 |
| `pickCoachRating` helper (Sprint 17) | ✅ | `shared/src/coaching/` |

---

## 4. Tasks

### Task 33.1 — Schema additions: phase week + training picks

**What:**

1. Add `phaseWeek: Int @default(0)` to `Season` — the index within the current phase's event sequence (0 = first event of the phase, increments per advance).
2. New table `TrainingFocusPick` to persist user-chosen attribute focuses for the upcoming Training Results event:
   ```prisma
   model TrainingFocusPick {
     id         String @id @default(cuid())
     seasonYear Int
     teamId     String
     coachId    String
     slotIndex  Int                              // 0..2
     attribute  String                           // one of TrainableSkill
     createdAt  DateTime @default(now())
     team       Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
     coach      Coach  @relation(fields: [coachId], references: [id], onDelete: Cascade)
     @@unique([seasonYear, teamId, coachId, slotIndex])
     @@index([seasonYear, teamId])
   }
   ```
3. New table `TrainingResultEntry` for the audit trail (one row per (player, attribute) pair that received a gain at the Training Results event):
   ```prisma
   model TrainingResultEntry {
     id           String @id @default(cuid())
     seasonYear   Int
     teamId       String
     playerId     String
     attribute    String
     gainApplied  Int
     wasBreakthrough Boolean @default(false)
     createdAt    DateTime @default(now())
     team         Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
     player       Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
     @@index([seasonYear, teamId])
     @@index([playerId])
   }
   ```

Migration timestamp `20261116_000000_offseason_event_calendar`.

**TDD approach:**
1. `tests/integration/migrations/offseasonEventCalendarMigration.test.ts`:
   - Apply on a fresh DB; assert columns + tables + indexes.
   - Idempotent re-apply (CLAUDE.md "From Sprint 25").

**Implementation:** straight schema additions + `prisma generate`.

**Acceptance:**
- [ ] Migration applies cleanly.
- [ ] Existing saves: `Season.phaseWeek` defaults to 0.

**Schema risk:** Medium — 2 new tables + column. Forward-compat verified.
**Effort:** Small (~1 h).

---

### Task 33.2 — Phase-event calendar + week-type enum

**What:** Replace the implicit "phase + currentWeek" model with an explicit per-phase event sequence the user advances through one event at a time. Each phase has an ordered list of event types; `Season.phaseWeek` is the index into that list.

```ts
// shared/src/season/phaseEvents.ts (new)

export type OffseasonEvent =
  | 'YEAR_SUMMARY'
  | 'COACH_LEVELING'
  | 'COACH_CAROUSEL'
  | 'PLAYERS_LEAVING'           // grad / eligibility expiry
  | 'PLAYERS_TRANSFERRING'      // transfer portal
  | 'RECRUITING_1'
  | 'RECRUITING_2'
  | 'RECRUITING_3'
  | 'SIGNING_DAY'
  | 'BOOSTER_UPDATES'
  | 'ADVANCE_YEAR';             // increments year, ages roster

export type PreseasonEvent =
  | 'POSITION_CHANGES'
  | 'TRAINING_FOCUS'            // user picks coach focuses
  | 'TRAINING_RESULTS'          // gains applied
  | 'GAMEPLAN'
  | 'FINALIZE';                 // promotes Recruit → Player rows, sets phase REGULAR

export const OFFSEASON_EVENTS: readonly OffseasonEvent[] = [
  'YEAR_SUMMARY', 'COACH_LEVELING', 'COACH_CAROUSEL',
  'PLAYERS_LEAVING', 'PLAYERS_TRANSFERRING',
  'RECRUITING_1', 'RECRUITING_2', 'RECRUITING_3', 'SIGNING_DAY',
  'BOOSTER_UPDATES', 'ADVANCE_YEAR',
];
export const PRESEASON_EVENTS: readonly PreseasonEvent[] = [
  'POSITION_CHANGES', 'TRAINING_FOCUS', 'TRAINING_RESULTS',
  'GAMEPLAN', 'FINALIZE',
];
```

`getCurrentEvent({ phase, phaseWeek })` resolves `Season` state to the active event.

**TDD approach:**
1. `tests/unit/season/phaseEvents.test.ts`:
   - Sequence integrity: every event reachable from index 0 by repeated `next()`.
   - Phase advance contract: stepping past the last offseason event transitions phase to `PRESEASON` with `phaseWeek=0`; past the last preseason event transitions to `REGULAR`.

**Implementation:**
1. `shared/src/season/phaseEvents.ts` (new).

**Acceptance:**
- [ ] Pure module, deterministic.

**Effort:** Small (~1 h).

---

### Task 33.3 — Backend: `advanceOffseasonEvent` (orchestrator)

**What:** Replace the single `runOffseason` path with `advanceOffseasonEvent(slotId, teamId)` that:

1. Reads `Season.phase` + `Season.phaseWeek`.
2. Resolves the current `OffseasonEvent` or `PreseasonEvent` from Task 33.2.
3. Dispatches to the per-event handler (each handler is small and idempotent).
4. Increments `phaseWeek` (or transitions phase if at the end).

Per-event responsibilities (mostly extracted from today's `runOffseason`):

| Event | Handler responsibility |
|---|---|
| `YEAR_SUMMARY` | Compute end-of-year awards summary view (already shipped in Sprint 18); just snapshot it for the user UI. |
| `COACH_LEVELING` | Apply experience-based ratingDevelop/ratingRecruit deltas to existing coaches (Sprint 17 logic; if absent, no-op). |
| `COACH_CAROUSEL` | Refresh hire-pool / fire dismissed coaches (today's `refreshCoachHiringPool`). |
| `PLAYERS_LEAVING` | Graduate seniors / fifth-years; mark eligibility expired. |
| `PLAYERS_TRANSFERRING` | Run the existing transfer portal (Sprint 14) in a single event for v1.2. **Out of scope for v1.2:** treating transfers as recruits with priorities/pitches (FCCD's `PlayerRecruitmentType.Transfer`) — deferred to v1.3. |
| `RECRUITING_1/2/3` | Advance the recruiting cycle by one "week" via the recruiting service. **Sprint 33 ships a thin shell** that calls today's `advanceRecruitingWeek`. **Sprint 35 deepens these handlers** with priority-driven interest, scout tier reveal, and recruiter quality. The Sprint 33 implementation MUST be replaceable without schema churn — keep the event handler module thin (3–5 LOC, just delegates). |
| `SIGNING_DAY` | Close recruiting cycle; flip COMMITTED → SIGNED; lock the class. **Sprint 35 hardens this** with the FCCD-style `canTeamWinRecruitingBattle` check and the 25-commit cap. |
| `BOOSTER_UPDATES` | Refresh booster goals for next year (Sprint 15). |
| `ADVANCE_YEAR` | Bump `Season.year`; age every Player.classYear; reset stats counters; clear `seasonStartYear`. |
| `POSITION_CHANGES` | (v1.2 stub) — auto position swaps for over/under-staffed positions; user UI deferred. |
| `TRAINING_FOCUS` | No backend mutation — just renders the picker UI. The "advance" press validates picks then increments `phaseWeek`. |
| `TRAINING_RESULTS` | **Apply training gains** (Task 33.4). Auto-pick AI team focuses if no `TrainingFocusPick` rows exist for them. |
| `GAMEPLAN` | (v1.2 stub) — gameplan picks deferred. |
| `FINALIZE` | Promote committed Recruits to Player rows for the user team + AI teams; set phase = REGULAR; reset `phaseWeek = 0`. |

**TDD approach:**
1. `tests/integration/offseason/advanceEventHappyPath.test.ts`:
   - From end-of-NCAA, walk every event with `advanceOffseasonEvent` until phase = REGULAR. Assert per-event side effects.
   - End-state matches today's `runOffseason` output for graduations + coach pool + recruit promotion.
2. `tests/integration/offseason/idempotentAdvance.test.ts`:
   - Calling `advanceOffseasonEvent` twice in a row mid-sequence does not double-apply (each event is idempotent).
3. `tests/integration/offseason/legacySaveOpens.test.ts`:
   - Open a save where `Season.phase === 'OFFSEASON'` was set by old `runOffseason`. The new orchestrator routes correctly (CLAUDE.md §6 forward-compat).

**Implementation:**
1. `main/src/offseason/advanceOffseasonEvent.ts` (new).
2. Per-event handlers under `main/src/offseason/events/<event>.ts`. Each is small, focused, idempotent.
3. `main/src/offseason/runOffseason.ts` — keep as a thin "advance through every remaining event" loop used by tests + (optionally) a debug skip-button.

**Acceptance:**
- [ ] Walking the full sequence reproduces today's `runOffseason` end-state byte-for-byte for the non-decision events.
- [ ] Decision events (`TRAINING_FOCUS`, `RECRUITING_*`) leave state unchanged on advance until the user has acted.

**Calibration risk:** Low. Same data-mutating operations, just sliced.
**Schema risk:** None.
**Effort:** Large (~6 h — touches every existing offseason side effect).

---

### Task 33.4 — Backend: `applyTrainingResults` (the gain event)

**What:** At `TRAINING_RESULTS` the engine:

1. Loads every `TrainingFocusPick` row for `(seasonYear, teamId)`. For each AI team without picks, runs the **AI focus heuristic** below.
2. For each coach × slot pick:
   - Computes `coachBreakthroughBonus = pickCoachRating(coach, 'develop')` mapped through a small constant (e.g. `(ratingDevelop − 50) / 5`, clamped to [0, 30]).
   - For every player on the team eligible for that attribute (all players are eligible to all attributes — FCCD doesn't gate by position):
     - `repeatedFocusCount` = how many earlier picks (lower slotIndex on the same team this offseason) targeted the same attribute.
     - Compute `range = getTrainingGainAmountRange({...})` (Sprint 32).
     - Roll a uniform integer gain in `[range.min, range.max]` via the seeded RNG `seasonYear:teamId:playerId:attribute`.
     - Roll a breakthrough at `getTrainingBreakthroughChance({...})`. On hit, add `+2` (FCCD's breakthrough bonus is small; calibrate later).
     - Apply: `Player.rating<Attribute> = clamp(current + gain + breakthroughBonus, 0, min(100, potential))`.
   - Insert one `TrainingResultEntry` per (player, attribute) pair.
3. Recompute `Player.overall` via existing `deriveOverall`.

**AI focus heuristic** (deterministic per `seasonYear:teamId`):

For each AI team's HC/AHC/AC:
- Compute, for every attribute that role can train, the **average headroom** across the roster: `avg(maxScale × attrCurve)`.
- Pick the top 3 attributes by average headroom (ties: alphabetical for determinism).

**TDD approach:**
1. `tests/integration/offseason/trainingResultsHappyPath.test.ts`:
   - Seeded league + user picks; advance to TRAINING_RESULTS; assert every player's ratings moved within the gain range; assert at least one breakthrough fires across 360 teams (probabilistic but deterministic).
2. `tests/unit/offseason/aiFocusHeuristic.test.ts`:
   - Fixed roster + coach roles → expected attribute picks.
   - Determinism: same season + team → same picks.
3. `tests/integration/offseason/repeatedFocusPenalty.test.ts`:
   - Same team, all 3 HC slots picking `athleticism` → 1st slot gain ≈ 1×, 2nd ≈ 0.6×, 3rd ≈ 0.4× (validate via mean of repeated trials).
4. `tests/integration/offseason/trainingResultsIdempotent.test.ts`:
   - Calling `applyTrainingResults` twice on the same season is a no-op (TrainingResultEntry rows already exist; second call observes that and skips).

**Implementation:**
1. `main/src/offseason/applyTrainingResults.ts` (new).
2. `main/src/offseason/aiFocusHeuristic.ts` (new).
3. Use `$transaction` array form for the bulk player updates (CLAUDE.md "From Sprint 13").

**Acceptance:**
- [ ] Every team's roster has at least some movement after the event.
- [ ] All 360 AI teams get gains (not just user team).
- [ ] Idempotent.
- [ ] Deterministic per seed.

**Calibration risk:** Medium. The first end-to-end league sim with this event is the moment to validate that league-wide ratings stay sane (no power creep). Add a 5-season smoke test in `test:calibration:full`.
**Schema risk:** None.
**Effort:** Large (~6 h).

---

### Task 33.5 — Renderer: offseason advance + training focus picker

**What:** Replace `OffseasonPanel.tsx`'s single CTA with an event-aware panel:

- **Per-event view** (most events): a "Year-in-Review"-style card showing what happened (e.g. "12 seniors graduated"; "Coach Carousel: 47 head-coach changes league-wide; 2 teams hired") + a single "Advance" button.
- **Decision events** trigger sub-screens:
  - `RECRUITING_1/2/3`, `SIGNING_DAY` → existing recruiting board (re-route).
  - `PLAYERS_TRANSFERRING` → existing portal view.
  - `TRAINING_FOCUS` → new **TrainingFocusPicker** (below).
  - `TRAINING_RESULTS` → results table grouped by player, sourced from `TrainingResultEntry` rows.

**TrainingFocusPicker UI:**
- Three coach panels (HC, AHC, AC) — one per slot of three.
- Each panel: dropdown of `getValidTrainingFocuses(role)` skills (3 options per role). Default selection: the attribute with highest average roster headroom for that role.
- Estimated team-wide gain preview: sum of `(range.min + range.max) / 2` across the roster for the picked attributes (small, just enough to give the user a sense).
- "Advance to Training Results" disabled until all 9 slots filled.

**Frontend Design Considerations:**
- Reuse existing offseason-panel CSS.
- Dense, data-first; keyboard-navigable.
- Show coach `ratingDevelop` next to each coach panel so the user understands the lever.

**TDD approach:**
1. `tests/unit/TrainingFocusPicker.test.tsx`:
   - 3 panels × 3 slots = 9 dropdowns, each with the 3 valid attributes for that role.
   - Default selection matches "highest avg roster headroom for the role's pool".
   - axe-clean.
2. `tests/unit/OffseasonPanel.test.tsx`:
   - Routing: each (phase, event) combo renders the correct sub-component.

**Implementation:**
1. `app/src/components/TrainingFocusPicker.tsx` (new).
2. `app/src/screens/OffseasonPanel.tsx` — refactor to switch on the resolved current event.
3. `app/src/store/useOffseasonStore.ts` — add `advanceEvent()`, `setTrainingFocusPick(coachId, slotIndex, attribute)`, `loadEventState()`.

**Acceptance:**
- [ ] User can advance through every offseason + preseason event end-to-end via the UI.
- [ ] Picking 9 slots + advancing fires `applyTrainingResults` and lands on the results table.
- [ ] axe-core zero violations.

**Effort:** Large (~5 h).

---

### Task 33.6 — Recruiting + portal re-scoping

**What:**

- **Recruiting** is no longer "auto-opens after Portal" or "stays open through regular season." It opens at the first `RECRUITING_1` event of the offseason and closes at `SIGNING_DAY`. **Mirrors FCCD: 3 offseason recruiting events + Signing Day.**
- The Sprint 31 retro change that auto-opened recruiting after PORTAL closes is **rolled back** — it conflicted with the FCCD model.
- Spring/Summer recruiting (FCCD has 4 preseason recruiting weeks) is **deferred to v1.3**. v1.2 ships only the offseason recruiting weeks for simplicity.
- The transfer **portal** runs entirely inside the `PLAYERS_TRANSFERRING` event for v1.2.

**TDD approach:**
1. `tests/integration/offseason/recruitingScopedToOffseason.test.ts`:
   - Open recruiting via `RECRUITING_1` advance; close via `SIGNING_DAY` advance.
   - Recruiting cycle is closed during regular season.
2. `tests/integration/offseason/portalScopedToEvent.test.ts`:
   - Portal opens + closes inside `PLAYERS_TRANSFERRING`.

**Implementation:**
1. `main/src/recruiting/openRecruitingCycle.ts` — only callable from `RECRUITING_1` handler.
2. `main/src/recruiting/closeRecruitingCycle.ts` — only callable from `SIGNING_DAY` handler.
3. `main/src/portal/closePortal.ts` — drop the auto-open-recruiting side effect.
4. `main/src/season/advanceWeek.ts` — drop `recruitingWeek` parallel-advance during REGULAR.

**Acceptance:**
- [ ] Recruiting only runs during offseason events.
- [ ] Portal only runs during its event.
- [ ] No regressions in existing recruiting tests; tests that assumed "stays open" are updated.

**Calibration risk:** Low (recruiting math unchanged).
**Schema risk:** None.
**Effort:** Medium (~3 h — re-routing existing flows).

---

### Task 33.7 — Documentation + invariants

**Edits:**
1. `CLAUDE.md` §Critical rules #4 — append:
   - "Offseason is an 11-event sequence: YEAR_SUMMARY → COACH_LEVELING → COACH_CAROUSEL → PLAYERS_LEAVING → PLAYERS_TRANSFERRING → RECRUITING_1 → RECRUITING_2 → RECRUITING_3 → SIGNING_DAY → BOOSTER_UPDATES → ADVANCE_YEAR. Preseason is a 5-event sequence: POSITION_CHANGES → TRAINING_FOCUS → TRAINING_RESULTS → GAMEPLAN → FINALIZE. The user advances one event at a time via `advanceOffseasonEvent`."
   - "Training gains apply ONCE per year at the TRAINING_RESULTS event, not per-week. Each coach (HC/AHC/AC) has 3 attribute focus slots = 9 picks per team. Gains apply to all eligible roster players for the focused attribute via the Sprint 32 curve."
   - "Recruiting cycle scope: opens at RECRUITING_1, closes at SIGNING_DAY. NOT open during regular season. Portal: opens + closes inside PLAYERS_TRANSFERRING."
   - "The Sprint 31 retro auto-open-recruiting-after-portal behavior is rolled back as part of Sprint 33."
2. `CLAUDE.md` "Gotchas" — placeholder for Sprint 33 retro at sprint close.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **33.1** (schema migration) — blocks everything.
2. **33.2** (phase-event calendar) — pure module.
3. **33.3** (orchestrator + per-event handlers).
4. **33.6** (recruiting/portal re-scoping) — runs alongside 33.3 since both touch the same handlers.
5. **33.4** (apply training results — heaviest backend work).
6. **33.5** (renderer UI).
7. **33.7** (docs).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 33 status |
|---|---|---|
| `advanceOffseasonEvent` per call | < 2 s | ⚠️ TRAINING_RESULTS is the only heavy event; others are cheap |
| `applyTrainingResults` total | < 8 s for 360 teams | ⚠️ ~360 teams × ~17 players × 9 attrs = ~55K rating reads + 9 writes per player ≈ ~3K updates per team. Use `$transaction` array form. |
| Save-file size | unchanged-ish | ⚠️ TrainingResultEntry: 360 teams × 17 players × ~3 picks/season ≈ 18K rows × 80 bytes ≈ 1.4 MB/season. Within budget but watch retention. |
| Renderer offseason transitions | < 100 ms p95 | ⚠️ measure |

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] Lint + typecheck + test + build green.
- [ ] `npm run test:calibration:full` unchanged (sim path unaffected).
- [ ] Manual UAT: user advances through all 11 offseason + 5 preseason events, picks training focuses for their coaches, observes gains in PlayerProfileModal afterward.
- [ ] AI rosters demonstrably grew over the offseason (sample 5 teams; sum of skill increases > 0).
- [ ] Sprint 33 retro authored.
- [ ] Tagged `sprint-33-complete`.

---

## 8. Out of scope

**Sprint 34** (next sprint): now repurposed — see Sprint 34 spec.

**Other v1.x deferrals:**
- Spring/Summer preseason recruiting weeks (FCCD has 4; v1.2 ships only offseason recruiting).
- Position-change UI at PRESEASON_POSITION_CHANGES (auto only in v1.2).
- Game-plan install at PRESEASON_GAMEPLAN (placeholder event in v1.2). Sprint 34 ships the per-week practice-focus modifier; the offseason gameplan-template install is a separate v1.3 system.
- Conference realignment + schedule customization events (not yet specced; FCCD has them, VCD doesn't yet).
- Facilities upgrade UI (Sprint 32 ships the column; v1.3 adds the upgrade flow).
- Coach-skill bonuses to training (e.g. TrainingExtraPreseasonFocus → extra slot) — `coachBreakthroughBonus` ships, additional slots deferred.

**Recruiting interactions (deferred to Sprints 35–36):**
- The FCCD-style priority-driven interest model (Q1 of the recruiting scope review).
- Pitch reasons (CoachPedigree, CoachConnection) — Sprint 36.
- Team NIL pool — Sprint 36.
- Recruiter Quality tier label — Sprint 36.
- Scout tier reveal — Sprint 35.
- Hardened SIGNING_DAY (commit-cap, scholarship-cap, `canTeamWinRecruitingBattle`) — Sprint 35.
- Transfer portal as recruit-with-priorities (FCCD `PlayerRecruitmentType.Transfer`) — v1.3.

The Sprint 33 recruiting handlers MUST be thin shells (delegate to existing recruiting service); Sprint 35 swaps their internals without touching the offseason calendar plumbing.

**Out of scope per FCCD parity:**
- Per-week practice mechanics during regular season (FCCD's `PracticeFocus` is a *gameplan* concept — see Sprint 34 spec for the deferred treatment).
- "Group practice" / multi-coach synergies.
