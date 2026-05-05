# Sprint 31 Spec — Rotation Editor + Tactical Hints + Live Mode Polish

**Window:** weeks 61–62 (post-Sprint-30; v1.1 scope finale)
**Status:** Spec authored 2026-05-04 from user-driven gameplay request (third of three Live Play sprints)
**Augments:** Sprints 29–30. Closes the Live Play feature with rotation control, real volleyball positional engine wiring, and a calibration verification.
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists

Sprints 29 + 30 give the user an in-match presence — they can pace the game and call timeouts/subs. But they have **no control over rotations** before a set starts, and the rally engine doesn't yet honor real volleyball positional rules (front-row attackers more dangerous, back-row attacks rarer/limited, back-row passing better, setter pattern). This sprint:

1. Adds a pre-set **rotation editor** — order, system (5-1 / 6-2), libero designation, one tactical hint per system.
2. Adds a **visual rotation tracker** in the scoreboard pane that updates live.
3. Wires **real volleyball positional rules** into the rally FSM (live mode only — `simulateMatch` stays unchanged for calibration determinism).
4. Polishes: "key rally" smart-pause notification, full a11y pass, calibration verification (live mode opt-in for any future calibration metric).

After this sprint, the Live Play feature is feature-complete for v1.1.

---

## 2. Sprint goal

A user opens a match in Live Play mode. Before set 1 starts, a Rotation Editor modal appears: drag/dropdown the six on-court players into P1..P6, pick 5-1 or 6-2, designate a libero, pick one of three tactical-hint presets (aggressive / balanced / defensive). The set plays out; the scoreboard shows a 6-cell visual tracker that highlights front/back row and rotates each side-out. Front-row attackers hit harder; back-row attacks are rarer; the setter rotates correctly per the chosen system. Between sets, the editor reopens for adjustments.

---

## 3. Inputs (must already exist after Sprints 29–30)

| Input | Status (post-S30) | Reference |
|---|---|---|
| Live Play Hub with Coaching Strategy pane | ✅ | Sprint 29/30 |
| `LiveMatchState.rotation` + `libero` fields | ✅ defined | Sprint 29 Task 29.1 |
| `coachActionLog` accepts `'rotation'` action kind | ✅ scaffolded | Sprint 29 Task 29.6 |
| Rotation engine (front/back row tracking + libero swap) | ✅ Sprint 4 | `shared/src/sim/rotation/...` |
| 5-1 / 6-2 system constants | ✅ Sprint 5 | `shared/src/sim/system.ts` |
| `pickStartersForTeam` (for fallback rotation if user skips editor) | ✅ Sprint 18 | `main/src/match/pickStarters.ts` |
| Existing rally FSM `skillModifier` channel for ratings boosts | ✅ Sprint 19 | exposed to live driver in S29 |
| FCCD rotation/lineup screens for design reference | ✅ | Sprint 28 §1 |
| `simulateMatch` calibration suite | ✅ unchanged through S29/S30 | `test:calibration:full` |

---

## 4. Tasks

### Task 31.1 — Rotation editor modal (order + system + libero + hint)

**What:** Modal that opens before set 1 starts (after match.live.start) and again before each subsequent set. User configures the on-court 6, system, libero, and tactical hint. Saving writes a `rotation` action to `coachActionLog` and updates `LiveMatchState.rotation` / `libero` / `system` / `tacticalHint` for the new set.

**UI components:**
- 6-cell P1..P6 grid with player dropdown per cell (filtered to roster, excludes already-placed players).
- System radio: **5-1** (default) / **6-2**.
- Libero dropdown: filtered to L-position roster players. Disabled if 6-2 selected with two-setter formation that locks libero (engine guidance shown).
- Tactical hint radio (Q9=C simplified to one-per-system per user revision): **Aggressive** / **Balanced** (default) / **Defensive**. Tooltips explain the per-hint engine effect (Task 31.3 lists exact deltas).
- "Suggested rotation" button — uses `pickStartersForTeam` to autofill (skip-friendly default).
- Validation: setter overlap rule (FIVB 7.4 — adjacent positions can't overlap); libero only in back row; no duplicate players.
- Save → applies + closes; Cancel → uses previous-set rotation (set 1 cancel uses suggested rotation).

**TDD approach:**
1. Component `tests/unit/RotationEditorModal.test.tsx`:
   - Renders 6 cells, system radio, libero dropdown, hint radio.
   - Player dropdown excludes already-placed.
   - Setter overlap validation: place setter at P1 and OPP at P2 → "Save" disabled with tooltip.
   - Libero limited to L-position players.
   - "Suggested" button autofills.
   - axe-clean (focus trap, accessible names).
2. Validation unit `tests/unit/sim/live/rotationValidation.test.ts`:
   - `validateRotation(slots, system, libero): { ok, errors[] }` — pure function.
   - Setter overlap: 5-1 setter at P1; OPP must be at P4 (opposite). Other configs error.
   - 6-2: two setters; one front-row, one back-row; opposite each other.
   - Libero in front row → error.

**Implementation:**
- `app/src/components/RotationEditorModal.tsx` — shadcn-style modal.
- `shared/src/sim/live/rotationValidation.ts` — pure function. Reuses Sprint 4 rotation engine constants.
- `app/src/screens/LivePlayHub.tsx` — opens the modal on `state.currentSet.index` change (when in `between_sets` phase added by Sprint 29 — phase enum extended this sprint if not already).
- IPC: `match.live.setRotation(matchId, { slots, system, libero, hint })` — validates + applies + appends action.
- Accept `Esc` to cancel; `Enter` (after focus on Save) to save.

**Acceptance:**
- [ ] Modal opens before set 1 + each subsequent set.
- [ ] Validation blocks invalid configs.
- [ ] Save persists to `LiveMatchState` + `coachActionLog`.
- [ ] Skip / Cancel uses sensible default.
- [ ] axe-core zero violations.

**Calibration risk:** None (live-only).
**Schema risk:** None (data lives in `coachActionsJson`).
**Effort:** Large (~6 h — UI is the hardest part).

---

### Task 31.2 — Visual rotation tracker (scoreboard pane)

**What:** 6-cell grid in the scoreboard pane showing the user's team's current on-court rotation. Front-row cells (P2, P3, P4) are highlighted (different background). Libero is marked with an "L" badge when on court. Updates each side-out (rotation shift).

**Reference:** FCCD's offense/defense personnel widget — small-footprint visual that lives in the corner of the score area. Standard volleyball convention is to draw the court with P1 in the back-right corner from the receiving team's POV.

**TDD approach:**
1. Component `tests/unit/RotationTracker.test.tsx`:
   - Given a `RotationState` with players A..F → renders 6 cells with names.
   - Front-row cells (indices for P2, P3, P4) have `aria-label` containing "front row."
   - Libero badge appears on the back-row cell where libero is currently substituted in.
   - On state change (rotation prop updates), cells re-render in shifted order.
   - axe-clean.

**Implementation:**
- `app/src/components/livePlay/RotationTracker.tsx` — pure presentational.
- Embed in `ScoreboardPane.tsx` (Sprint 29 component) at the bottom. Toggle "show opponent rotation" with a pref (default off).
- Use CSS grid 3×2 to lay out P4-P3-P2 / P5-P6-P1 (standard volleyball court orientation).
- Color tokens: `bg-front-row` (subtle highlight) for P2/P3/P4. Use shadcn semantic tokens (CLAUDE.md #7 a11y — contrast required).

**Acceptance:**
- [ ] Tracker renders correctly for any rotation.
- [ ] Updates after every side-out.
- [ ] Front/back row distinction is contrast-AA accessible.
- [ ] axe-core zero violations.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Small-Medium (~3 h).

---

### Task 31.3 — Real volleyball positional engine wiring

**What:** Wire the rally FSM to honor positional rules. **Live mode only** (gated by `state.useLivePositionalRules: true`). `simulateMatch` calibration path **unchanged** — preserves Sprint 5 calibration goldens.

**Engine effects (locked):**
- **Front-row attack ratings × 1.10.** Sampling for front-row attackers uses the boosted rating.
- **Back-row attack frequency cap.**
  - Aggressive hint: cap = 0.45 (45% of attempts may be from back row).
  - Balanced hint: cap = 0.30.
  - Defensive hint: cap = 0.20.
  - Cap enforced at attempt-selection time: if back-row attempts in current set / total attempts >= cap, force selection to a front-row attacker.
- **Back-row passer ratings × 1.10.** Reception sampling uses boosted rating for back-row players (P1, P5, P6).
- **6-2 setter rotation.** Already supported by rotation engine; verify integration with the new `system` field. When current setter rotates to front row, OPP becomes setter for that rotation.
- **5-1 setter dump (defensive hint only):** very low-frequency (5% of dead-ball setter touches when setter is front-row); engine generates a "setter dump" attack event.
- **Libero auto-swap:** unchanged from Sprint 4 engine; verify it interplays with the `libero` field set by the editor.

**Per-hint summary table:**

| Hint | Front-row attack mult | Back-row attack cap | Back-row pass mult | Setter dump (5-1, FR) |
|---|---|---|---|---|
| Aggressive | ×1.10 | 0.45 | ×1.05 | 7% |
| Balanced (default) | ×1.10 | 0.30 | ×1.10 | 5% |
| Defensive | ×1.10 | 0.20 | ×1.15 | 3% |

(All multipliers are baseline-vs-Sprint-5 — applied multiplicatively over momentum + skill-talk boosts.)

**TDD approach:**
1. Unit `tests/unit/sim/live/positionalRules.test.ts`:
   - Front-row attack: 10K sampled attacks → front-row attempt rate within ±2% of expected (which is `position-based mix × 1.10` weighting).
   - Back-row cap: 10K attacks under each hint → back-row share within ±2% of cap.
   - Back-row pass: 10K receptions → back-row passer success rate within ±1.5% of expected boost.
   - 6-2 rotation: across 18 rotations, setter is correct player for each.
   - 5-1 setter dump: under defensive hint, 1K dead-ball setter-front-row events → ~3% are dumps.
2. Integration `tests/integration/match/livePositionalRules.test.ts`:
   - Full match in each hint mode → final box score reflects expected positional split (front-row K share higher than back-row K share by clear margin).
3. **Critical: calibration determinism** `tests/unit/calibration/simMatchUnchanged.test.ts`:
   - `simulateMatch(seed)` produces byte-identical box score to Sprint 5 golden for 50 seeds. Live-mode positional rules MUST NOT bleed into the sim-only path.

**Implementation:**
- `shared/src/sim/live/positionalRules.ts`:
  - `applyPositionalMultipliers(skillRating, position, isAttacker, state): number`
  - `shouldForceFrontRowAttack(state, team): boolean` — cap check.
  - `shouldSetterDump(state, team, rng): boolean` — hint + position check.
- Rally FSM consumes via the `skillModifier` + a new `attackTargetSelector` channel (small refactor, isolated).
- Gating: positional rules ONLY active when `state.kind === 'live'` (a discriminator field added to `LiveMatchState` to distinguish from any future state shape). `simulateMatch` does not produce a `LiveMatchState` — it uses the existing one-shot path.

**Acceptance:**
- [ ] All Monte Carlo expectations within tolerance.
- [ ] `simMatchUnchanged.test.ts` passes (calibration goldens intact).
- [ ] 6-2 rotation correct across full set.
- [ ] Setter dumps appear at expected rate.

**Calibration risk:** **High if gating fails.** The gating discriminator is the load-bearing piece. CI must include the calibration-unchanged test as a blocker.
**Schema risk:** None.
**Effort:** Large (~6 h — engine wiring, careful Monte Carlo validation).

---

### Task 31.4 — "Key rally" smart-pause notification + Coaching pane build-out

**What:** Add the "key rally" smart-pause trigger (set point, match point) — pause + show a banner so the user can call timeout / sub before the rally plays. Wire the rotation editor entry point into the Coaching Strategy pane.

**Key-rally definition:**
- Set point: any rally where one team is at `setScoreNeeded - 1` (24 in sets 1-4; 14 in set 5) AND leads by ≥1.
- Match point: set point in the deciding-set scenario where `setsWon[leader] === setsToWin - 1`.

**Banner copy:** "**Set point** — opponent serves at 24-23. [Call timeout] [Continue]"
- Buttons inline: Call Timeout, Continue (proceed with rally).
- Auto-dismiss after 8s if user inaction.

**Coaching Strategy pane addition:**
```
... (Sprint 30 sections)
─────────────────────────────────────────────────────
ROTATION (next set)
[Edit Rotation] (opens editor; disabled mid-set)
Current: 5-1, Balanced, Libero #4 Williams
─────────────────────────────────────────────────────
```

**TDD approach:**
1. Unit: key-rally detector pure function — table of (setScore, setIndex, setsWon, setsToWin) → expected `isSetPoint / isMatchPoint`.
2. Component: banner renders, buttons functional, auto-dismiss timer (use vi.useFakeTimers).
3. Integration: smart-pause triggers on set-point rally; "Continue" → rally proceeds; "Call timeout" → opens skill-talk modal.

**Implementation:**
- `shared/src/sim/live/keyRally.ts` — `isKeyRally(state): { setPoint: bool; matchPoint: bool }`.
- Extend `smartPause.ts` registry with new trigger.
- `app/src/components/livePlay/KeyRallyBanner.tsx`.
- Coaching Strategy pane gets the rotation summary + edit button.

**Acceptance:**
- [ ] Set-point + match-point detected correctly.
- [ ] Banner functional + auto-dismisses.
- [ ] Rotation summary in pane reflects last-saved rotation.
- [ ] axe-core zero violations.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Medium (~3.5 h).

---

### Task 31.5 — Save-file impact + persistence sweep

**What:** Confirm `coachActionsJson` for a 5-set live match stays under budget. Verify no regression to the Sprint 23 35 MB / 10-season save-file bar.

**Approach:**
- Generate a worst-case 5-set live match: 250 rallies, ~10 timeouts, ~30 subs, 5 rotations. Serialize and measure.
- Estimate: rally events ~250 × 60 bytes = 15 KB; coach actions ~50 × 200 bytes = 10 KB; rotation snapshots ~5 × 600 bytes = 3 KB. **Target: < 30 KB per live match.**
- Run `tests/integration/save/save10Seasons.test.ts` with 100 of those seasons including ≥10 live matches per season → confirm save file ≤ 35 MB (Sprint 23 bar) + ≤ 25 MB (PRD §3.5 long-term goal — track but don't gate).

**TDD approach:**
1. Unit: `coachActionsJson` size assertion on synthetic worst case.
2. Integration: extend Sprint 23 save-size test to include live-match data.

**Acceptance:**
- [ ] Worst-case live match serializes under 30 KB.
- [ ] 10-season save with mixed live + sim matches stays within Sprint 23 35 MB bar.

**Calibration risk:** None.
**Schema risk:** None (just measurement).
**Effort:** Small (~1.5 h).

---

### Task 31.6 — A11y pass + manual UAT + retro

**What:** Full a11y audit on every Sprint 29–31 surface (`LivePlayHub`, every pane, every modal, banner, tracker). Manual end-to-end UAT.

**Audit checklist:**
- axe-playwright on `LivePlayHub` (CLAUDE.md "From Sprint 21").
- Keyboard nav: Tab through every interactive element, Enter activates, Esc closes modals + cancels actions.
- Screen reader pass: NVDA / Narrator reads PBP events, score updates, momentum changes (live regions), key-rally banner.
- Color contrast: front-row vs back-row cells (Task 31.2), momentum-tier indicators, smart-pause banners — all ≥ AA.
- Focus management: rotation editor opens with focus on first dropdown; closes restoring focus to "Edit Rotation" button.

**Manual UAT script:**
1. Start save, open match, click Play.
2. Set rotation editor: place starters, pick 6-2, set libero, pick Defensive hint.
3. Sim 5 rallies — observe scoreboard, momentum.
4. Call timeout, talk about Block — observe boost banner.
5. Sub a player.
6. Hit Sim Set — observe smart-pause on opponent timeout.
7. Set 2 starts → editor reopens; switch to 5-1 + Aggressive.
8. Sim Match — observe smart-pause on set point; call timeout.
9. Pause match (quit dialog), relaunch app, hit Resume Live, finish match.
10. Confirm final box score persisted, `coachActionsJson` populated.

**Acceptance:**
- [ ] axe-core zero violations on all surfaces.
- [ ] Keyboard-only flow completes UAT script.
- [ ] Manual UAT passes end-to-end in < 10 minutes (PRD §3.5 implicit — Sprint 31 is the gate where this becomes real).
- [ ] Sprint 31 retro authored at `docs/retros/sprint-31-retrospective-{date}.md`.

**Effort:** Medium (~3 h).

---

### Task 31.7 — Documentation + invariants finalization

**Edits:**
1. **CLAUDE.md §Critical rules #4** — append:
   - "Live mode positional rules (front-row attack ×1.10, back-row attack cap by hint, back-row pass ×1.10, 5-1 setter dump) are gated by `LiveMatchState.kind === 'live'`. The `simulateMatch` driver is unaffected and remains calibration-deterministic."
   - "Rotation validation: 5-1 setter and OPP are opposite (P1↔P4, P2↔P5, P3↔P6); 6-2 has two setters opposite each other; libero is back-row-only."
2. **CLAUDE.md "Gotchas" — Sprint 29/30/31 batch entry.** Add at sprint close. Topics:
   - Sub-path export pattern reused for `@vcd/shared/sim/live/*`.
   - Calibration determinism gating (the `kind === 'live'` discriminator).
   - Rotation editor focus management gotchas (test-fixture pattern).
3. **PRD §3.5** — confirm 10-min match target met (UAT pass).
4. **PRD §5 Sprint 29/30/31** — finalize all three entries with exit-test cross-references.

**Effort:** Small (~45 min).

---

## 5. Order of execution

1. **31.3** (positional engine wiring) — biggest engine change; do first to leave room for tuning.
2. **31.1** (rotation editor modal) — UI-heavy; can run in parallel with 31.3 (different files).
3. **31.2** (visual tracker) — small; after 31.1 lands the rotation state.
4. **31.4** (key rally + pane build-out) — needs 31.1 entry point.
5. **31.5** (save-file impact) — measurement only; run after others land.
6. **31.6** (a11y + UAT + retro) — sprint close.
7. **31.7** (docs) — alongside other tasks; final pass at close.

---

## 6. Performance budget watch

| Surface | Budget | Sprint 31 status |
|---|---|---|
| Single match sim < 150 ms | unchanged | ✅ `simulateMatch` untouched |
| `simulateRallyStep` per call | < 5 ms | ⚠️ positional rules add ~0.3 ms — confirm bench |
| Rotation editor open → render | new — < 100 ms | ⚠️ measure |
| Rotation tracker re-render on side-out | new — < 30 ms | ⚠️ measure |
| `coachActionsJson` per live match | < 30 KB | ✅ Task 31.5 verifies |
| Save-file ≤ 35 MB / 10 seasons | unchanged for sim-only; live matches add modest data | ⚠️ Task 31.5 verifies |
| **End-to-end live match real time < 10 min** | **NEW — PRD §3.5** | ⚠️ Task 31.6 UAT verifies |

Run `npm run bench` before sprint close.

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] Lint + typecheck + test + build green.
- [ ] `npm run test:calibration:full` **unchanged** — no drift from positional-rules engine wiring.
- [ ] axe-core zero violations across all Sprint 29–31 live-mode surfaces.
- [ ] Manual UAT script completes in under 10 minutes real time.
- [ ] PR includes CLAUDE.md + PRD updates.
- [ ] Sprint 31 retro authored.
- [ ] **Live Play feature feature-complete for v1.1.**
- [ ] Tagged `sprint-31-complete` and (if shipping batch) `live-play-v1.1-complete`.

---

## 8. Out of scope (v1.2+)

- **Per-rotation tactical hints** (originally Q9=C; cut to one-per-system for this sprint). v1.2 may revisit if user wants more granularity.
- **Coach AI suggestions** during live play ("opponent on a 4-0 run — call timeout?", "rotation 3 is your weakest — consider sub?").
- **"Watch your live match back" replay** — uses `coachActionsJson` (populated since Sprint 29) and PBP. Could be a v1.2 nice-to-have.
- **Live mode in calibration** — sim-only path remains the calibration metric. Live mode is not deterministic across coach inputs and is excluded by design.
- **Network multiplayer / hot-seat** — PRD §2 (never).
- **Coach portrait + speech bubble during timeouts** — cosmetic, deferred.
- **Fatigue surfaced in UI** — fatigue model exists from Sprint 30 (used for AI subs); not yet user-visible.
- **Timeout types** (30s vs 60s differentiation) — only one TO type modeled; NCAA actually has 60s + 75s media timeouts. Cosmetic.
