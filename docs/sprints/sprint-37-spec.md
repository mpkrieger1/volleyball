# Sprint 37 Spec — v1.2 Hardening + FCCD-Parity Wiring

**Window:** weeks 73–74 (post-Sprint-36; v1.2 hardening sprint)
**Status:** Spec authored 2026-05-04 from Sprint 32–36 retro review + the "Option 2" surgical pass that resolved the trivially-mechanical baseline failures and built the championship aggregator.
**Augments:** All v1.2 sprints (32–36). Closes the deferred-work backlog that accumulated across the recruiting + player-development batches.
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists

The v1.2 batch (Sprints 32–36) shipped substantial functionality on the math + plumbing side, but accumulated 5 deferred items that block the user-visible payoff of the FCCD-parity work. Plus, the inherited Sprint 28 in-progress baseline has ~24 remaining failing tests (down from 39 after the post-Sprint-36 surgical pass) — most are deeper Sprint-13/Sprint-28-era issues that no v1.2 sprint touched.

This sprint:

1. **Closes the 5 carry-forward items** so the v1.2 recruiting + player-development work becomes user-visible.
2. **Resolves the ~24 remaining Sprint 28 baseline failures** so `npm test` is finally green.
3. **Runs `test:calibration:full`** to verify the v1.2 math hasn't drifted league-wide stats.
4. **Tags `recruiting-fccd-parity-complete` + `player-development-fccd-parity-complete`** on completion.

---

## 2. Sprint goal

After Sprint 37:

- `computeBaseInterest` wrapper deleted; `computeBoardScore` rewritten against the new priority helper at the right magnitude.
- `advanceRecruitingWeek` recomputes interest each tick from `priorities × levels` (Sprint 35 carry-forward).
- AI loop applies pitch reasons + recruiter quality each tick.
- `getRecruitDetail` IPC payload extended; Sprint 36 sub-components slotted into `RecruitDetailModal`.
- `npm run lint && npm test && npm run typecheck && npm run build` all green.
- `test:calibration:full` runs and passes (or thresholds widened with retro documentation).
- v1.2 batch tagged.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 35 priority model + helpers | ✅ | `shared/src/recruiting/priorityModel.ts` |
| Sprint 36 pitch reasons + NIL + recruiter quality helpers | ✅ | `shared/src/recruiting/{pitchReasons,nilOffer,recruiterQuality}.ts` |
| Sprint 36 modal sub-components | ✅ | `app/src/components/{PrioritiesReadout,PitchReasonsCard,ScoutTierIndicator,NilOfferSlider}.tsx` |
| Championship aggregator | ✅ (Sprint 37 prep) | `main/src/recruiting/championships.ts` |
| Sprint 36 IPC schema gaps | ⚠️ | `shared/src/ipc/recruitingMessages.ts` `RecruitDetailView` |

---

## 4. Tasks

### Task 37.1 — Delete `computeBaseInterest` wrapper + magnitude rework

**What:** Remove the deprecated wrapper in `shared/src/recruiting/interestModel.ts`. Rewrite `computeBoardScore` to call `computeRecruitTeamInterest` directly (returns 0..100) and produce a 0..1000 magnitude via a single `× 10` scale. Update commit-resolution thresholds (`HOT_INTEREST_THRESHOLD = 600`, `INTEREST_FLOOR = 30`) if needed to preserve the 60% commit-rate exit test.

**Affected callers (verified):**
- `main/src/recruiting/openRecruitingCycle.ts:133` (board seed)
- `main/src/recruiting/advanceRecruitingWeek.ts:168` (replenishment ranking)
- `tests/unit/recruiting/interestModel.test.ts` (18 tests — delete, replaced by `priorityModel.test.ts`)

`shared/src/portal/pursuit.ts` only references the helper in a comment — no migration needed.

**TDD approach:**
1. Run `tests/integration/recruiting/cycleEndToEnd.test.ts` (synthesize if missing) — assert ≥60% commit rate, top-5 prestige avg ≥2.7 stars, no team over MAX_ROSTER_SIZE.
2. Update calibration tolerances per Sprint 25 widening precedent if needed.

**Acceptance:**
- [ ] Wrapper deleted; no callers remain.
- [ ] `computeBoardScore` calls priority helper directly.
- [ ] 18 legacy tests deleted; new tests cover the priority path.
- [ ] Sprint 13 exit tests still pass.

**Effort:** Medium (~3 h — calibration risk).

---

### Task 37.2 — Per-tick interest recompute in advanceRecruitingWeek

**What:** Replace the delta-patched stored interest field with a per-tick recompute. Sprint 35 carry-forward.

**Implementation:**
1. Pre-load (team, recruit) attribute levels + priorities once per call.
2. For each tick, compute `base = computeRecruitTeamInterest(...)` per pair.
3. Persist `interest = base + earnedPoints` (where `earnedPoints` is the cumulative weekly action delta now stored separately).
4. Migration: add `RecruitInterest.earnedPoints Int @default(0)` column. Backfill = current `interest` value.

**TDD approach:**
1. `tests/integration/recruiting/perTickRecompute.test.ts`:
   - Bumping facilitiesLevel mid-cycle changes per-tick interest; persisted earnedPoints stays put.
   - Determinism: same seed + same inputs → same result.

**Acceptance:**
- [ ] AI loop uses recomputed interest, not stored delta-patched.
- [ ] Bumping team attributes mid-cycle reflects in next tick.
- [ ] Cycle exit tests still pass.

**Effort:** Medium-Large (~4 h).

---

### Task 37.3 — Wire pitch reasons + AI auto-apply

**What:** AI teams auto-apply pitch reasons each tick (Sprint 36 spec mandate, deferred).

**Implementation:**
1. Pre-compute `ChampionshipsHistory` per team at cycle open (uses Sprint 37 `championships.ts`).
2. Pass `pitchBonusPoints = computePitchReasons(...).totalActivePoints` into per-tick `computeRecruitTeamInterest` calls.
3. AI's interest values now reflect pitch + NIL + priority math.

**Acceptance:**
- [ ] AI team with championship history scores higher on pitch-active recruits.
- [ ] Determinism preserved.

**Effort:** Medium (~3 h).

---

### Task 37.4 — Extend `getRecruitDetail` IPC + slot Sprint 36 components into RecruitDetailModal

**What:** The bulk of the user-visible Sprint 36 payoff.

**Implementation:**
1. Extend `RecruitDetailView` zod schema with:
   - `priorities: RecruitPriorities`
   - `wantsToLeaveHome: boolean`
   - `pitchReasons: PitchReasonResult[]`
   - `recruiterQualityByCoach: Array<{ coachId; role; quality }>`
   - `nilBudgetCents: number`
   - `nilBudgetUsedCents: number`
   - `nilOfferCents: number`
2. Update `recruiting:detail` handler to populate these from priority/pitch/championship/nil aggregators.
3. Slot the 4 Sprint 36 sub-components into `RecruitDetailModal.tsx`:
   - Battle tab: PrioritiesReadout, PitchReasonsCard ×2, NilOfferSlider
   - Scouting tab: ScoutTierIndicator (above existing scout-report)
4. Add `useRecruitingStore.setNilOffer` action.
5. Extend `window.d.ts` recruiting interface with `setNilOffer`.

**Acceptance:**
- [ ] Modal renders all 4 new sub-components.
- [ ] axe-core zero violations.
- [ ] NIL slider edits persist.

**Effort:** Large (~5 h — bulk of sprint).

---

### Task 37.5 — Resolve remaining Sprint 28 baseline failures

**What:** ~24 still-failing tests after the surgical pass:

| Test file | Failures | Probable root cause |
|---|---|---|
| `tests/integration/coaching/fullCycle.test.ts` | 1 | Sprint 35 priority math drift on AHC recruiter exit test |
| `tests/integration/offseason/coachLifecycle.test.ts` | 1 | Monte Carlo flake or Sprint 33 refactor side effect |
| `tests/integration/offseason/fullCycle.test.ts` | 2 | Sprint 33 dev model replaced (cap test); Sprint 33 starter-grow test fundamentally broken |
| `tests/integration/portal/cycle.test.ts` | 1 | Sprint 28 roster size (4320 vs 6120) |
| `tests/integration/postseason/fullPostseason.test.ts` | 1 | Mystery — need investigation |
| `tests/integration/recruiting/fullCycle.test.ts` | 3 | Sprint 35 magnitude drift on Monte Carlo exit tests |
| `tests/integration/recruiting/promoteCommittedRecruits.test.ts` | 4 | Sprint 28 in-progress recruiting cycle not finishing |
| `tests/unit/MatchHub.test.tsx` | 7 (worker-OOM) | Pre-existing memory-pressure, not regression |

**Strategy:**
- **Mechanical fixes first:** portal/cycle (roster size), MatchHub OOM (split test file or increase worker memory).
- **Math drift:** widen Monte Carlo thresholds per Sprint 25 precedent OR re-author against the new model.
- **Truly broken tests:** Sprint 33 "starters grow more than benchwarmers" — DELETE. The test cannot pass against the new dev model by design.

**Acceptance:**
- [ ] Lint + typecheck + test + build all green.

**Effort:** Large (~5 h — investigative).

---

### Task 37.6 — Run `test:calibration:full` + tune

**What:** Execute the slow nightly calibration suite. Document drift; tune constants if anything regresses.

**Acceptance:**
- [ ] Calibration suite runs to completion.
- [ ] If anything fails: tune (Sprint 32 facilities table, Sprint 33 training gain magnitudes, Sprint 36 NIL multiplier, etc.) OR widen thresholds with retro justification.

**Effort:** Medium (~3 h depending on what's broken).

---

### Task 37.7 — Tag + retro

**What:** Verify all gates green, tag `sprint-37-complete`, `recruiting-fccd-parity-complete`, `player-development-fccd-parity-complete`. Write retro.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **37.5** (baseline cleanup — partial; mechanical fixes only) — gets `npm test` to a known state before refactors.
2. **37.1** (delete wrapper) — touches the most consumers; do early before more code accumulates around the wrapper.
3. **37.2** (per-tick recompute) — depends on 37.1's magnitude rework.
4. **37.3** (pitch reasons in AI) — depends on 37.2.
5. **37.4** (modal IPC + slotting) — biggest task; depends on 37.3 (provides the data the IPC payload needs).
6. **37.5** (remainder of baseline cleanup — Monte Carlo widening + dev-model test deletion).
7. **37.6** (calibration suite).
8. **37.7** (tag + retro).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 37 watch |
|---|---|---|
| `advanceRecruitingWeek` per call | < 1.5 s | ⚠️ per-tick recompute adds ~10K dot products. Profile. |
| `getRecruitDetail` IPC | < 50 ms | ⚠️ now does championship aggregator + pitch reasons + 4 priority sub-payloads. Pre-aggregate where possible. |
| `RecruitDetailModal` render | < 100 ms | ⚠️ measure with all 4 sub-components mounted. |
| `test:calibration:full` runtime | nightly job | informational |

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] `npm run lint && typecheck && test && build` green for the FIRST time since Sprint 28 in-progress started.
- [ ] `npm run test:calibration:full` runs to completion (passes OR thresholds widened with retro).
- [ ] Manual UAT: open a save mid-cycle. Click any recruit → see modal with priorities + pitch reasons + scout tier dots + NIL slider. Adjust NIL, observe budget tracker decrement.
- [ ] Sprint 37 retro authored.
- [ ] Tagged: `sprint-37-complete`, `recruiting-fccd-parity-complete`, `player-development-fccd-parity-complete`.

---

## 8. What this closes from prior retros

### From Sprint 32 retro
- (None new; Sprint 32 was clean.)

### From Sprint 33 retro
- ⚠️ "starters grow more than benchwarmers" `fullCycle.test.ts` exit test 2 — **DELETE** (test is fundamentally broken by design pivot).
- v1.2 PRD §5 extension — out of scope (doc work).

### From Sprint 34 retro
- (None blocking; Sprint 34 was clean.)

### From Sprint 35 retro
- ✅ `computeBaseInterest` wrapper deletion → Task 37.1.
- ✅ `advanceRecruitingWeek` per-tick recompute → Task 37.2.
- ✅ Roster cap check earlier → already functionally equivalent; deferred to v1.3.

### From Sprint 36 retro
- ✅ Modal IPC extension + slotting → Task 37.4.
- ✅ Championship aggregator → already built (this Sprint 37 prep pass).
- ✅ AI pitch-reason auto-apply → Task 37.3.
- ✅ Read-before-Edit pattern → CLAUDE.md §0 added (workflow rule top-of-file).

---

## 9. Out of scope

**Deferred to v1.3+:**
- HC tenure attribution table (currently championships are over-attributed across HCs).
- Earlier roster cap check (Sprint 35 deferral; functionally equivalent to current).
- Spring/Summer recruiting weeks.
- Transfer portal as recruit-with-priorities.
- Real `getRecruitRubberbandMultiplier` curve.
- Marketing-level multiplier on NIL.
- Per-coach recruiter assignment screen.
- DraftSuccess + ProgramStability pitch reasons.

These remain v1.3+ items. Sprint 37 closes the v1.2 batch; v1.3 starts a new spec cycle.
