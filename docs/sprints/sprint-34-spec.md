# Sprint 34 Spec — Weekly Game-Plan Practice Focus

**Window:** weeks 67–68 (post-Sprint-33; v1.2 player-development batch finale)
**Status:** Spec rewritten 2026-05-04 to mirror Football Coach: College Dynasty's `PracticeFocus` mechanic. Replaces the original "in-season per-match Gaussian skill drift" approach, which has no FCCD analogue.
**Augments:** Sprint 32 (training gain helpers), Sprint 33 (offseason calendar). Third of three sprints (32/33/34) overhauling player development to match FCCD.
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists — and why the original spec was scrapped

The original Sprint 34 spec proposed **per-match Gaussian skill drift**: every player who appeared in a match would have all 9 skills nudged by a small random draw at the end of every match, capped at ±10% of season-start ratings. **FCCD has no such mechanic.** A search of `coreWorker.js` finds no per-match rating mutation; ratings change only at the `PreseasonTrainingResults` event (Sprint 33's `TRAINING_RESULTS`). Adding match-by-match drift would diverge from the FCCD model the user asked us to mirror.

What FCCD **does** have during the regular season is **`PracticeFocus`** — each week the offensive and defensive coordinators pick a practice focus (e.g. `QuickPassing`, `DefendDownfieldPassing`) tailored to the upcoming opponent's tendencies. The picks give the team a **small in-game bonus** for the upcoming match against play categories matching the focus. **Practice focus does NOT change ratings**; it's a per-match modifier on play execution.

Sprint 34 ports this to volleyball: each regular-season week the user picks an **offensive focus** and a **defensive focus** (one each from a small enumerated list); the choices give the team a small per-match bonus on the upcoming match. The Sprint 32 helpers and Sprint 33 calendar are reused; this sprint adds the weekly practice-focus pick and a thin sim-engine hook to apply the bonus.

---

## 2. Sprint goal

After Sprint 34: each regular-season week, the renderer shows a **PracticeFocusPicker** (offensive + defensive focus) for the user's upcoming match. Defaults are chosen automatically based on the opponent's serve/attack tendencies (the volleyball analogue of FCCD's `getAutoPracticeFocus`). On match start (Match Hub Sim path or `advanceWeek`), the engine applies a small bonus modifier (≤ 5% expected effect on the targeted play category). AI teams get auto-picks via the same heuristic. Practice focus does **not** mutate `Player.rating*` — it's a per-match buff only.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Offseason event calendar + `Season.phaseWeek` | ⚠️ Sprint 33 dependency | Sprint 33 spec |
| Current week tracking during REGULAR | ✅ | `main/src/season/advanceWeek.ts` |
| Match Hub Sim + `simulateAndPersist` | ✅ | Sprint 19 |
| Live-mode `simulateMatch` driver (calibration-deterministic by `seed` alone) | ✅ | CLAUDE.md §Critical rules #2 |
| Opponent stat aggregation (PMS rollups) | ✅ | Sprint 18 |

---

## 4. Tasks

### Task 34.1 — Schema additions: weekly practice focus

**What:** New table `PracticeFocusPick` for the user team's per-week picks (one row per week per team). AI picks are computed on the fly and not persisted (deterministic per `seasonYear:teamId:week`).

```prisma
model PracticeFocusPick {
  id          String @id @default(cuid())
  seasonYear  Int
  week        Int                              // regular-season week 0..13
  teamId      String
  offenseFocus String                          // OffensePracticeFocus enum value
  defenseFocus String                          // DefensePracticeFocus enum value
  createdAt   DateTime @default(now())
  team        Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  @@unique([seasonYear, week, teamId])
  @@index([seasonYear, teamId])
}
```

Migration timestamp `20261130_000000_practice_focus_picks`.

**TDD approach:**
1. `tests/integration/migrations/practiceFocusMigration.test.ts`:
   - Apply migration; assert table + indexes.
   - Idempotent re-apply (CLAUDE.md "From Sprint 25").

**Implementation:** straight schema addition.

**Acceptance:**
- [ ] Migration applies cleanly.

**Effort:** Small (~1 h).

---

### Task 34.2 — Pure helper: `getValidPracticeFocuses` + `getAutoPracticeFocus`

**What:** Volleyball analogue of FCCD module 7538. Two enums + the auto-picker.

```ts
// shared/src/season/practiceFocus.ts (new)

export type OffensePracticeFocus =
  | 'POWER_HITTING'        // attack-heavy
  | 'BALL_CONTROL'         // pass + set
  | 'SERVE_AGGRESSION'     // serve
  | 'TRANSITION_OFFENSE';  // mixed

export type DefensePracticeFocus =
  | 'BLOCK_HEAVY'
  | 'DEFEND_TIPS_ROLLS'
  | 'DEFEND_POWER_HITTING'
  | 'SERVE_RECEIVE_FOCUS';

export function getValidOffenseFocuses(): readonly OffensePracticeFocus[];
export function getValidDefenseFocuses(): readonly DefensePracticeFocus[];

// Pick the focus that best counters the opponent's last-N-match tendencies.
// FCCD parallel: getAutoPracticeFocus(opponentTeamTendencies).
export function getAutoOffenseFocus(opponentDefenseTendencies: OpponentSummary): OffensePracticeFocus;
export function getAutoDefenseFocus(opponentOffenseTendencies: OpponentSummary): DefensePracticeFocus;
```

`OpponentSummary` rolls up the last 3 matches' PMS rows: serve aggression rate, hitting%, % of attacks from front row, dig efficiency, etc. The auto-picker maps these to the most useful counter (e.g. opponent ace-rate > 8% → `SERVE_RECEIVE_FOCUS`; opponent hitting% > 35% → `BLOCK_HEAVY`).

**TDD approach:**
1. `tests/unit/season/practiceFocus.test.ts`:
   - Coverage: every enum value reachable from at least one synthetic opponent profile.
   - Determinism: identical opponent profile → identical auto-pick.

**Implementation:**
1. `shared/src/season/practiceFocus.ts` (new).
2. Re-export via `@vcd/shared/season`.

**Acceptance:**
- [ ] Pure module, deterministic.

**Effort:** Small-Medium (~2 h).

---

### Task 34.3 — Pure helper: `applyPracticeFocusBonus`

**What:** Tiny modifier applied at match start. Returns multiplicative bonuses to specific sim probabilities for the focused play category. Pure, no IO.

```ts
export interface PracticeFocusModifier {
  attackBonus: number;        // multiplicative; 1.0 = no change
  serveBonus: number;
  passBonus: number;
  blockBonus: number;
  digBonus: number;
}

export function applyPracticeFocusBonus(
  offense: OffensePracticeFocus,
  defense: DefensePracticeFocus,
): PracticeFocusModifier;
```

Bonus magnitudes are **small** — each focused phase gets ~1.03–1.05× (a 3–5% expected effect, in line with FCCD's gameplan-install nudges). Out of scope: multiplicative stacking with skill-talk boosts (Sprint 30) — handled by the sim engine via the existing modifier-composition pattern.

**TDD approach:**
1. `tests/unit/season/practiceFocusBonus.test.ts`:
   - Each (offense, defense) pair returns finite bonuses in [0.95, 1.10].
   - Identity: no focus chosen ⇒ all 1.0.

**Implementation:**
1. Same module as 34.2.

**Acceptance:**
- [ ] All combos return well-formed modifiers.

**Effort:** Small (~1 h).

---

### Task 34.4 — Sim engine integration: thread modifier through match start

**What:** The match simulator already accepts coach-side modifiers. Extend the input contract with an optional `practiceFocusModifier: PracticeFocusModifier` per side. The driver applies it once at match start by scaling the relevant probability table entries.

**Strict guard for calibration determinism:** the `simulateMatch` driver remains byte-equal under identical `seed` for the **default** modifier (all 1.0). Practice focus is opt-in — the production match path passes the user's pick + the AI's auto-pick; the calibration suite passes the default modifier and is unaffected. This mirrors the Sprint 29 amendment for live-mode features (CLAUDE.md §Critical rules #2).

**TDD approach:**
1. `tests/unit/sim/practiceFocusDeterminism.test.ts`:
   - Byte-equality: `simulateMatch(seed, defaultModifier) === simulateMatch(seed)` (calibration invariant).
2. `tests/unit/sim/practiceFocusEffect.test.ts`:
   - Run 1000 sims with `attackBonus = 1.05`; team's hitting% should be ~1–2 percentage points higher than baseline (small but detectable).

**Implementation:**
1. `workers/src/sim/simulateMatch.ts` — accept the optional modifier; apply at probability-table init.
2. `main/src/match/simulateAndPersist.ts` + `main/src/season/advanceWeek.ts` — load `PracticeFocusPick` row (or compute AI auto-pick) and pass into the worker dispatch.
3. `shared/src/ipc/matchMessages.ts` — extend the worker request schema.

**Acceptance:**
- [ ] Calibration suite (`test:calibration:full`) unchanged.
- [ ] Detectable effect on team performance with non-default modifier.

**Calibration risk:** **High** if the default-modifier branch isn't byte-equal — that's the gate. Verify with a checksum on a 100-match sim with random seeds.
**Effort:** Large (~5 h).

---

### Task 34.5 — Backend IPC: weekly practice focus pick

**What:** Two IPCs:

1. `practiceFocus.getWeekState(slotId, teamId, week)` → returns `{ offenseFocus, defenseFocus, autoOffenseSuggestion, autoDefenseSuggestion, opponentSummary }`.
2. `practiceFocus.setPick(slotId, teamId, week, offenseFocus, defenseFocus)` → upserts the row.

The pick is editable any time before the week's matches sim. After sim, the row is read-only (audit log).

**TDD approach:**
1. `tests/integration/season/practiceFocusIpc.test.ts`:
   - getWeekState returns sensible auto-suggestions.
   - setPick upserts; second setPick replaces.
   - After advancing the week, setPick rejects with `WEEK_ALREADY_PLAYED`.

**Implementation:**
1. `main/src/ipc/practiceFocusHandlers.ts` (new).
2. `shared/src/ipc/practiceFocusMessages.ts` (new).
3. `main/src/preload.ts` + `app/src/types/window.d.ts` — expose.

**Acceptance:**
- [ ] Round-trips work; AI defaulting works for unset weeks.

**Effort:** Medium (~3 h).

---

### Task 34.6 — Renderer: weekly PracticeFocusPicker

**What:** Compact card on the season dashboard's "Next Match" tile. Two dropdowns (offense, defense), each defaulting to the auto-suggestion with a small label "(suggested)". A "Reset to suggestion" button. Below the dropdowns: the opponent summary (last 3 matches' tendencies) so the user can see why the suggestion was made.

**Frontend Design Considerations:**
- Reuse existing dashboard tile primitives.
- Dense; the entire card should be < 220 px tall.
- Per CLAUDE.md #7 a11y — semantic form controls, AA contrast.

**TDD approach:**
1. `tests/unit/PracticeFocusPicker.test.tsx`:
   - Renders two dropdowns; default selections match auto-suggestions.
   - Changing a dropdown calls setPick.
   - "Reset to suggestion" restores defaults.
   - axe-clean.

**Implementation:**
1. `app/src/components/PracticeFocusPicker.tsx` (new).
2. `app/src/screens/SeasonDashboard.tsx` — slot the picker into the Next Match tile.
3. `app/src/store/usePracticeFocusStore.ts` (new).

**Acceptance:**
- [ ] User can change next-match focuses and the change persists across nav.
- [ ] axe-core zero violations.

**Effort:** Medium (~3 h).

---

### Task 34.7 — Documentation + invariants

**Edits:**
1. `CLAUDE.md` §Critical rules #4 — append:
   - "Practice focus is a per-week sim modifier, NOT a rating mutation. Each regular-season week the user picks one offensive + one defensive focus; AI teams use the auto-heuristic. The modifier (~3–5%) is applied at match start; ratings are unchanged."
   - "Calibration invariant: `simulateMatch(seed)` with default (1.0×) practice-focus modifier is byte-equal to `simulateMatch(seed)` without any modifier argument. Verified by `tests/unit/sim/practiceFocusDeterminism.test.ts`."
   - "v1.2 has NO per-match in-season skill drift. Ratings only change at the offseason TRAINING_RESULTS event (Sprint 33). The original Sprint 34 'Gaussian per-match drift' design is rejected because it has no FCCD analogue."
2. `CLAUDE.md` "Gotchas" — placeholder for Sprint 34 retro at sprint close.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **34.1** (schema migration).
2. **34.2** (focus enums + auto-picker) — pure module.
3. **34.3** (modifier helper) — pure module.
4. **34.4** (sim engine integration) — heaviest, validates the determinism guard.
5. **34.5** (IPC).
6. **34.6** (renderer UI).
7. **34.7** (docs).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 34 status |
|---|---|---|
| `simulateMatch` per call | < 150 ms | ✅ modifier is a single multiplicative pass at table init; trivial cost |
| `advanceWeek` total | < 8 s for 170 matches | ✅ +1 row read per match for AI auto-pick computation |
| Save-file size | unchanged-ish | ⚠️ PracticeFocusPick rows: 14 weeks × 1 row (user team only) = 14 rows/season ≈ 1 KB. Negligible. |
| Dashboard render | < 100 ms | ✅ small card |

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] Lint + typecheck + test + build green.
- [ ] **Calibration suite (`npm run test:calibration:full`) unchanged.** This is the load-bearing exit gate.
- [ ] Manual UAT: user advances through a season, picks practice focuses each week, observes they persist and that the suggestion logic responds to opponent tendencies.
- [ ] Sprint 34 retro authored.
- [ ] Tagged `sprint-34-complete`.

**Note on sprint ordering:** the recommended ship order is **32 → 33 → 35 → 36 → 34**. Sprints 32–33 land FCCD-parity training + offseason calendar; Sprints 35–36 land FCCD-parity recruiting (which depends on Sprint 33's SIGNING_DAY event); Sprint 34 (practice focus) is independent and can land last. If 32+33+34 also ship as a single player-development batch, additionally tag `player-development-fccd-parity-complete`.

---

## 8. Out of scope

**Explicitly rejected (FCCD parity):**
- **Per-match in-season Gaussian skill drift.** No FCCD analogue. The original Sprint 34 design.
- **Targeted skill drift via game outcomes.** Same reasoning.
- **Streak / momentum effects on ratings.** Same.
- **End-of-season "Year in Review" rating-change report.** Ratings only change at TRAINING_RESULTS, where the existing results table already shows all gains.

**Deferred to v1.3+:**
- Spring/Summer preseason recruiting weeks (FCCD has 4; v1.2 ships only offseason recruiting per Sprint 33).
- Position-changes UI at PRESEASON_POSITION_CHANGES.
- Game-plan installs at PRESEASON_GAMEPLAN (FCCD has full gameplan templates; v1.2 only ships weekly practice focus).
- Practice-focus interaction with skill-talk boosts (Sprint 30) — currently they compose multiplicatively via the existing modifier pipeline; explicit interaction tuning deferred.
- Conference realignment + schedule customization events (FCCD has them; VCD doesn't yet).

**Out of scope per FCCD:**
- Injury-driven rating drops — FCCD doesn't have these mid-season either.
- Coaching-during-the-season modifiers to ratings (FCCD's coach skills affect training in offseason only).
