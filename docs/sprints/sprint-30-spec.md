# Sprint 30 Spec — Coach Actions (timeouts + substitutions)

**Window:** weeks 59–60 (post-Sprint-29; v1.1 scope continued)
**Status:** Spec authored 2026-05-04 from user-driven gameplay request (companion to Sprint 29 / 31)
**Augments:** Sprint 29 Live Play foundation. Extends NCAA volleyball rules into the live-play loop.
**Personal-use note:** Continues Sprint 28 framing — FCCD timeout / sub UX may be referenced freely as design source.

---

## 1. Why this sprint exists

Sprint 29 ships a passive Live Play Hub — the user can step through a match but cannot influence it. This sprint gives them the two most-used coach actions:

1. **Timeouts** — call to halve opponent momentum and (optionally) talk up a skill for a temporary +5% boost.
2. **Substitutions** — swap players in/out within NCAA's 15-sub-per-set cap; libero swaps auto-handled by the engine.

Both actions:
- Persist into `coachActionsJson` (Sprint 29 column).
- Affect downstream rallies via `simulateRallyStep`'s `coachInputs` channel.
- Surface in the PBP ticker.
- Trigger smart-pause when the *opponent* uses one (so the user can react).

---

## 2. Sprint goal

A user mid-Live-Play can call timeouts, pick a skill to talk about, and make substitutions through the Coaching Strategy pane. The actions affect the next several rallies. The opponent (AI) calls timeouts and makes subs back, and the user's "Sim 5" / "Sim Match" controls pause when the opponent acts so the user can respond.

---

## 3. Inputs (must already exist after Sprint 29)

| Input | Status (post-S29) | Reference |
|---|---|---|
| `simulateRallyStep` with `coachInputs` channel | ✅ wired but unused | Sprint 29 Task 29.1 |
| `LiveMatchState` with `timeoutsUsed`, `subsUsed`, `activeBoost` fields | ✅ defined | Sprint 29 Task 29.1 |
| `coachActionsJson` write path | ✅ scaffolded (writes empty arrays) | Sprint 29 Task 29.6 |
| Coaching Strategy pane (`CoachingStrategyPane.tsx`) | ✅ shell with sim controls only | Sprint 29 Task 29.3 |
| HC + Coach rating data (Sprint 13/17 coach lifecycle) | ✅ | `Coach` table |
| 15-sub-per-set NCAA rule | ✅ embedded in CLAUDE.md "From Sprint 4" historical notes; not yet enforced in live | n/a |
| Smart-pause registry on Live Play controller | ✅ stub from Sprint 29 (set-point + momentum-swing only) | Sprint 29 Task 29.3 |
| AI opponent decision logic for matches the user isn't playing | ❌ — not needed (opponent during a Live match is the only AI opponent we model here) | new this sprint |

---

## 4. Tasks

### Task 30.1 — Timeout system (call, NCAA cap, momentum halving)

**What:** Coach can call a timeout from the Coaching Strategy pane during a dead ball. NCAA cap of 2 timeouts per team per set (Q6=B). Calling a TO halves the *opponent's* current momentum, rounded down (Q5=C).

**Rules:**
- **Dead ball only.** Timeout button disabled mid-rally (live-state has a `betweenRallies: bool` field after Sprint 29 each rally completion).
- **2 per set per team.** Counter resets at start of each set. 3rd attempt blocked with toast.
- **Halve opponent momentum.** If opponent has +5 momentum, becomes +2 (`floor(5/2)`). Calling team's momentum unchanged.
- **AI opponent calls TOs too.** Decision rule (deterministic): call a TO if `(self.momentum === 0 && opponent.momentum >= 3 && timeoutsRemaining > 0 && setScoreDiff <= -3)`. One TO per dead ball max; cooldown 5 rallies between AI TOs.

**TDD approach:**
1. Unit `tests/unit/sim/live/timeout.test.ts`:
   - 3rd TO call in a set rejected.
   - Calling TO halves opponent momentum (5 → 2, 4 → 2, 1 → 0, 0 → 0).
   - Call-side momentum unchanged.
   - Cap resets at set boundary.
   - AI decision rule deterministic per (state, seed).
2. Integration `tests/integration/match/liveTimeout.test.ts`:
   - Live match → user calls TO → state reflects momentum drop + counter increment + `coachActionsJson` entry.
   - Sim 20 rallies where opponent meets AI TO trigger → at least one AI TO recorded.

**Implementation:**
- `shared/src/sim/live/timeout.ts`:
  - `canCallTimeout(state, team): boolean`
  - `applyTimeout(state, team, skill?): LiveMatchState` — handles cap check, momentum halving, action log, optional skill boost (Task 30.2).
  - `aiShouldCallTimeout(state, team, rng): boolean`
- `simulateRallyStep`:
  - Before sampling next rally, check `aiShouldCallTimeout` for the side that is NOT controlled by the user (`state.userTeam`). If true, apply TO and append to `coachActionLog`.
  - User-initiated TOs come in via `coachInputs.timeout = { skill? }` parameter.
- IPC: `match.live.callTimeout(matchId, skill?)` → returns updated state. Renderer's Coaching Strategy pane button wires here.
- UI: timeout button on Coaching Strategy pane shows "TOs left: N/2"; opens skill-talk modal (Task 30.2) on click; if skip-skill is allowed, dismissing modal still calls TO.

**Acceptance:**
- [ ] Cap enforced; 3rd attempt rejected.
- [ ] Opponent momentum halving correct.
- [ ] AI TO logic produces at least one AI TO over a 1000-rally Monte Carlo where the trigger condition is hit.
- [ ] `coachActionLog` populated correctly.
- [ ] Smart-pause triggers when opponent calls TO (Task 30.4 detail).

**Calibration risk:** **Live-only feature** (per Sprint 29 architecture). `simulateMatch` calibration unaffected.
**Schema risk:** None.
**Effort:** Medium (~4 h).

---

### Task 30.2 — Skill-talk picker + boost engine

**What:** When calling a TO, user picks a skill (or "Skip") in a modal. Picked skill gets +5% multiplicative boost to that team's rating in the rally engine for the next N points, where `N = max(7, 5 + round(HC.strategy / 10))`.

**Rules (locked):**
- 6 skills: serve, pass, attack, block, dig, set (Q7=A).
- Boost duration: `max(7, 5 + round(HC.strategy / 10))` (Q8=A + user-confirmed floor).
  - HC.strategy=0  → max(7, 5) = 7
  - HC.strategy=20 → max(7, 7) = 7
  - HC.strategy=50 → max(7, 10) = 10
  - HC.strategy=100 → max(7, 15) = 15
- Stacks **multiplicatively** with momentum bonus. (Both confirmed.)
- One active boost per team. Calling another TO + picking a skill replaces the existing boost (no stacking same-team).
- Boost decrements by 1 every match-point played (both teams' points count toward the decrement).
- Boost clears when `pointsRemaining === 0`.

**TDD approach:**
1. Unit `tests/unit/sim/live/skillBoost.test.ts`:
   - Duration formula spot-checks (table-driven).
   - 1000-rally Monte Carlo with attack-talk active vs not → attack rate within ±0.5% of `(baseline × 1.05)`.
   - Stacking: attack-talk + Team-A-momentum+3 → effective multiplier within ±0.5% of `1.05 × 1.025`.
   - Decrement: after exactly N points played, boost clears.
   - Replace: second TO with different skill replaces, doesn't stack.
2. UI test `tests/unit/SkillTalkModal.test.tsx`:
   - 6 skill cards + Skip button.
   - Confirm → IPC fired with skill.
   - Skip → IPC fired with `skill: undefined`.
   - axe-clean.

**Implementation:**
- `shared/src/sim/live/skillBoost.ts`:
  - `boostDurationFor(hcStrategy: number): number` — formula.
  - `effectiveSkillMultiplier(state, team, skill): number` — combines momentum + boost.
- Rally FSM consumes `effectiveSkillMultiplier` instead of raw rating during sampling. Pass through the existing `skillModifier` channel (Sprint 19 coach-AI hook).
- `app/src/components/SkillTalkModal.tsx` — radio-card selection, shadcn-style.
- Coaching Strategy pane: clicking timeout opens the modal first; modal Confirm/Skip → IPC `match.live.callTimeout(matchId, skill?)`.

**Acceptance:**
- [ ] Effect verified within ±0.5%.
- [ ] Stacking with momentum within ±0.5%.
- [ ] Duration formula correct across HC.strategy spectrum.
- [ ] Boost cleanly clears at `pointsRemaining === 0`.
- [ ] axe-core zero violations on modal.

**Calibration risk:** Live-only.
**Schema risk:** None.
**Effort:** Medium (~3.5 h).

---

### Task 30.3 — Substitution system (15-cap, libero auto)

**What:** User can swap players via the Coaching Strategy pane. Enforces NCAA 15-sub-per-set cap (Q10=C). Libero swaps auto-handled by the engine — no user UI for libero (it lives in the rotation flow, Sprint 31).

**Rules:**
- **15 subs per team per set.** Counter resets at set start.
- **Dead ball only.** Same gate as timeouts.
- **Position-balanced enforcement (light):** sub must be a roster player not currently on court. Position match is a soft warning (UI shows "you're putting an OPP in for a MB"), not a hard block — strategically a coach can do it; engine handles ratings honestly.
- **No re-entry slot tracking** (Q10=C — relax this NCAA rule for v1.x; revisit if calibration shows abuse).
- **Libero auto-handled** by engine: any time a back-row defensive position is occupied by a non-libero, the engine auto-swaps the libero in for that rotation. Cleared when the original player rotates to front row. Existing rotation engine (Sprint 4) supports this; just verify in tests.
- **AI opponent makes subs.** Simple decision: sub off any starter whose `fatigueLevel` (computed from sets played + rallies played) exceeds threshold; replace with highest-rated bench player at same position. One sub per dead ball max.

**TDD approach:**
1. Unit `tests/unit/sim/live/substitution.test.ts`:
   - 16th sub attempt rejected.
   - Cap resets at set start.
   - Sub state correctly updates `state.rotation`.
   - Libero auto-swap on back-row rotation when starter is non-libero.
   - AI sub decision deterministic per (state, seed).
2. Integration `tests/integration/match/liveSubstitution.test.ts`:
   - Sub through a full set; counter increments correctly.
   - PBP ticker shows sub events with formatted line ("→ #14 Smith subs in for #7 Jones").

**Implementation:**
- `shared/src/sim/live/substitution.ts`:
  - `canSubstitute(state, team): boolean`
  - `applySubstitution(state, team, outIdx, inPlayerId): LiveMatchState`
  - `aiPickSubstitution(state, team, rng): { outIdx, inPlayerId } | null`
- IPC: `match.live.substitute(matchId, outIdx, inPlayerId)`.
- UI: Coaching Strategy pane gets a "Substitute" section showing on-court 6 + bench list; click an on-court row to "select to remove," then click bench row to "select to bring in," confirm. Or shadcn drag-and-drop if cheap.
- PBP integration: append `{ kind: 'sub', team, outId, inId }` event; prettifier formats it.
- Roster fatigue model (lightweight, used for AI sub decisions): `fatigue = setsPlayed * 0.5 + ralliesPlayedThisSet * 0.02`. Pure formula in `shared/src/sim/live/fatigue.ts`. Not surfaced in UI this sprint.

**Acceptance:**
- [ ] 15-cap enforced + reset per set.
- [ ] User subs reflected in next rally's lineup.
- [ ] Libero auto-swap continues working post-sub.
- [ ] AI subs at least once per match in 80%+ of seeds (Monte Carlo).
- [ ] PBP ticker formats sub events correctly.

**Calibration risk:** Live-only.
**Schema risk:** None.
**Effort:** Large (~5 h — sub UI is finicky).

---

### Task 30.4 — Smart-pause: opponent action triggers

**What:** Hook opponent timeouts and substitutions into the smart-pause registry built in Sprint 29 Task 29.3. When user is mid-"Sim 5/10/Set/Match," pause if opponent does either.

**TDD approach:**
1. Integration `tests/integration/match/liveSmartPause.test.ts`:
   - Set up state where AI will call TO on next rally → user calls `playRallies(20)` → call returns after `< 20` rallies with `pauseReason: 'opponent_timeout'`.
   - Same for opponent sub: `pauseReason: 'opponent_substitution'`.
   - Stacks with existing triggers (set point, momentum swing).

**Implementation:**
- Extend `shared/src/sim/live/smartPause.ts` (created in Sprint 29) with two new triggers.
- Live Play Hub UI: when paused with `pauseReason === 'opponent_timeout'` etc., show a banner "Opponent called timeout — they talked about [skill]" or "Opponent subbed [out] for [in]." Banner auto-clears on next user action.

**Acceptance:**
- [ ] Pause triggers correctly per scenario.
- [ ] Banner renders + clears.
- [ ] Sim controls resume from paused state with no state corruption.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Small-Medium (~2 h).

---

### Task 30.5 — Coaching Strategy pane Sprint 30 build-out

**What:** Add the timeout + substitution affordances to the Coaching Strategy pane. Sim controls (Sprint 29) stay; new sections layer on.

**Layout (within the pane):**
```
[Sim controls: Next pt | 5 | 10 | Set | Match | Pause]
─────────────────────────────────────────────────────
TIMEOUTS                                  TOs left: 2/2
[Call Timeout] (opens skill-talk modal)
Active boost: Attack +5% (8 pts left)
─────────────────────────────────────────────────────
SUBSTITUTIONS                             Subs: 3/15
[Substitute] (opens sub picker)
─────────────────────────────────────────────────────
(Sprint 31: Rotation editor section here)
```

**TDD approach:**
1. Component `tests/unit/CoachingStrategyPane.test.tsx`:
   - Renders all sections.
   - Buttons disabled mid-rally.
   - "TOs left" badge updates after callTimeout IPC mock.
   - Active boost banner shows skill + remaining points.
   - axe-clean.

**Implementation:**
- Extend `CoachingStrategyPane.tsx` with three new sections.
- Wire to `useLivePlayStore` selectors for the relevant state slices.
- Keyboard shortcuts: `T` for timeout, `S` for substitution (when pane has focus). Document in tooltips.

**Acceptance:**
- [ ] All sections render + functional.
- [ ] axe-core zero violations.
- [ ] Keyboard shortcuts work.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Medium (~3 h).

---

### Task 30.6 — Documentation updates

**Edits:**
1. **CLAUDE.md §Critical rules #4** — append:
   - "Live mode: each team capped at 2 timeouts per set; counter resets at set start."
   - "Live mode: each team capped at 15 substitutions per set; libero swaps do not count."
   - "Live mode: skill-talk boost duration = `max(7, 5 + round(HC.strategy / 10))` points."
2. **CLAUDE.md "Gotchas"** — Sprint 30 retro will populate at sprint close.
3. **PRD §5 Sprint 30** — finalize entry with exit tests below.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **30.1** (timeout core) — foundation; needed for Tasks 30.2/30.4/30.5.
2. **30.2** (skill-talk + boost) — extends 30.1.
3. **30.3** (substitution) — independent of timeouts; can run in parallel with 30.2.
4. **30.4** (smart-pause hookup) — needs 30.1 + 30.3.
5. **30.5** (UI build-out) — needs 30.1+30.2+30.3 IPC done; UI is the integration point.
6. **30.6** (docs).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 30 status |
|---|---|---|
| `simulateRallyStep` per call | < 5 ms (S29) | ⚠️ AI TO/sub decision adds ~0.2 ms — confirm bench |
| Coaching pane re-render on action | < 50 ms p95 | ⚠️ measure |
| `coachActionsJson` size after 5-set match | new — < 20 KB | ✅ small |

---

## 7. Exit criteria

- [ ] All 6 tasks' acceptance checkboxes ticked.
- [ ] Lint + typecheck + test + build green.
- [ ] Calibration suite (`test:calibration:full`) **unchanged**.
- [ ] axe-core zero violations on Coaching Strategy pane + skill-talk modal + sub picker.
- [ ] Manual UAT: user plays a match, calls 2 timeouts (one with skill talk, one without), makes 4 substitutions, opponent responds with their own actions; user observes momentum/boost effects on PBP outcomes.
- [ ] Sprint 30 retro authored.
- [ ] Tagged `sprint-30-complete`.

---

## 8. Out of scope (Sprint 31 + later)

- Sprint 31: rotation editor, system pick (5-1 / 6-2), libero designation UI, tactical hint, visual rotation tracker, real-volleyball positional engine wiring.
- v1.2+: timeout *suggestions* from coach AI ("opponent on a 4-0 run — call a TO?"); fatigue surfaced in UI; per-rotation tactical hints (cut from Sprint 31 to one-per-system).
