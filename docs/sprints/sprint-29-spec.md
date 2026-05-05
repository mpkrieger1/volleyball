# Sprint 29 Spec — Live Play Foundation (incremental engine + 4-pane hub + momentum)

**Window:** weeks 57–58 (post-Sprint-28; v1.1 scope)
**Status:** Spec authored 2026-05-04 from user-driven gameplay request
**Augments:** PRD §5 — extends Sprint 5 rally FSM, Sprint 19 Match Hub, Sprint 21 a11y bar.
**Personal-use note:** Continues Sprint 28 framing — FCCD live-game UX may be referenced freely as a design source. Inspiration only; no asset reuse.

---

## 1. Why this sprint exists

The user can currently only **simulate** matches (one-shot via `simulateMatch`) and **watch a replay** (Sprint 19 Match Hub). There is no way to *play* a match — make decisions during it, react to momentum, intervene tactically. This sprint lays the foundation for live play:

- A pausable, incremental sim driver so the engine can advance one rally at a time.
- A 4-pane Live Play Hub that surfaces PBP, score/match stats, my-team stats, and a coaching-strategy pane (sim controls only this sprint).
- Momentum tracking — a new gameplay system the user defined: leader's `momentum = floor(|scoreA − scoreB| / 2)`; every +3 momentum tier grants ×1.025 to all skills.
- Pause-and-resume persistence so the user can quit mid-match and come back.

Sprints 30 and 31 layer coach actions (timeouts, subs, rotations) on top of this foundation.

---

## 2. Sprint goal

A user clicks **Play** on a fixture in Match Hub. The Live Play Hub opens. The user steps through the match using sim controls (next point / 5 / 10 / set / match), watches PBP fill in, sees score and momentum update live, and sees their team's per-player stats accumulate. If they quit mid-match they get a Return / Pause / Sim-Rest dialog. A paused match shows up as **Resume Live** in Match Hub. No coach actions yet (those are Sprint 30).

The existing `simulateMatch` path (used for non-user-team match advance and calibration) is **untouched** and remains deterministic-by-seed.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 19 Match Hub + replay scheduler | ✅ | `app/src/match/replayScheduler.ts`, `useMatchHubStore` |
| Rally FSM (Sprint 4–5) | ✅ | `shared/src/sim/...` |
| `simulateMatch` one-shot driver (Sprint 6+) | ✅ | `main/src/match/simulateAndPersist.ts` |
| `pickStartersForTeam` (Sprint 18) | ✅ | `main/src/match/pickStarters.ts` |
| `Season.userTeamId` (Sprint 21) | ✅ | `prisma/schema.prisma` |
| `useUserTeamStore` (Sprint 21) | ✅ | `app/src/store/...` |
| Sub-path export pattern for shared/src node-only modules (Sprint 19) | ✅ | CLAUDE.md "From Sprint 19" |
| Migration timestamp convention (sprint-aligned, future-dated) | ✅ | CLAUDE.md "From Sprint 19/25" |
| axe-playwright e2e harness (Sprint 21) | ✅ | `tests/e2e/programBuildingA11y.spec.ts` |
| FCCD install for design reference | ✅ | Sprint 28 §1 |

---

## 4. Tasks

### Task 29.1 — Incremental sim driver (`simulateRallyStep`)

**What:** Build a pausable, serializable rally engine that shares the existing rally FSM. The current `simulateMatch` runs the full match in one call; live play needs to advance one rally at a time and hold state between calls.

**Approach:** Per Q1=B reconciliation — keep `simulateMatch` for sim-only / calibration paths. Add a parallel `simulateRallyStep(state, coachInputs?)` in `@vcd/shared/sim/live` that internally delegates to the same rally FSM. Two drivers, one FSM.

**TDD approach:**
1. Unit `tests/unit/sim/liveStep.test.ts`:
   - `playRallies(N)` then `playRallies(M)` produces identical `LiveMatchState` to `playRallies(N+M)` for the same seed (incremental == one-shot).
   - `simulateMatchLive(seed, [])` (no coach inputs) produces a byte-identical box score to `simulateMatch(seed)` for 50 random seeds.
   - State is JSON-serializable (round-trip via `JSON.parse(JSON.stringify(state))` produces an equal state).
2. Golden-fixture test: replay an existing one-shot match through the live driver in 1-rally steps; final box score equals the original. **Do NOT regenerate any existing rally-FSM goldens** — this task must not change rally outputs.

**Implementation:**
- New module `shared/src/sim/live/state.ts` — `LiveMatchState` zod schema:
  ```ts
  {
    matchId: string;
    seed: number;             // immutable root seed
    rallyCursor: number;      // # of rallies played; drives sub-seed for next rally
    teamA: TeamLiveState;
    teamB: TeamLiveState;
    setsWon: { A: number; B: number };
    currentSet: { A: number; B: number; index: 0..4 };
    server: 'A' | 'B';
    momentum: { A: number; B: number };  // recomputed each rally
    timeoutsUsed: { A: number[]; B: number[] };  // per-set arrays, each capped at 2 in Sprint 30
    subsUsed: { A: number; B: number };          // per current set
    activeBoost: null | { team: 'A'|'B'; skill: SkillKey; pointsRemaining: number };
    rotation: { A: RotationState; B: RotationState };
    libero: { A: LiberoState; B: LiberoState };
    pbpEvents: PbpEvent[];    // accumulated; final value matches `Match.pbpJson` shape
    boxScore: BoxScore;       // accumulated; final value matches `Match.boxScoreJson`
    status: 'in_progress' | 'finished';
  }
  ```
  Held in main process memory + persisted to `Match.liveStateJson` on pause / app-quit.
- New module `shared/src/sim/live/step.ts` — `simulateRallyStep(state, coachInputs?: CoachInputs): { newState, rallyResult }`. Pure function. Internally calls existing rally FSM with deterministic sub-seed `hash(state.seed, state.rallyCursor)`. `coachInputs` parameter is `undefined` this sprint; reserved for Sprint 30.
- Helper `simulateMatchLive(seed, coachActions[]): MatchResult` — drives `simulateRallyStep` to completion. Used by tests and by "Sim Rest" (Task 29.6).
- **Sub-path export:** `simulateRallyStep` lives at `@vcd/shared/sim/live` (sub-path), NOT re-exported from the top-level barrel. CLAUDE.md "From Sprint 19/25" rule — even though this is pure code, isolating it as a sub-path keeps the boundary clean and lets future PBP-codec-style additions slot in.

**Acceptance:**
- [ ] `simulateMatch` calibration test (`npm run test:calibration:full`) unchanged.
- [ ] All exit-test invariants hold across 50 seeds.
- [ ] State serialization round-trip preserves equality.
- [ ] `simulateRallyStep` < 5 ms per call (well within the per-match budget).

**Calibration risk:** **Zero** — the incremental driver shares the FSM. If the calibration suite drifts, the incremental wrapper has a bug.
**Schema risk:** None (state is in-memory only this task; persistence is Task 29.5).
**Effort:** Medium-Large (~5 h).

---

### Task 29.2 — Momentum system

**What:** Wire the user-defined momentum model into the live engine.

**Rules (per user spec, locked):**
- Leader's momentum = `floor(|scoreA − scoreB| / 2)`. Trailer's = 0.
- Recomputed after every rally.
- Resets at start of every set.
- For every +3 momentum a team holds, all of that team's skills get ×1.025 (multiplicative).
- Tiers stack: +3 → ×1.025; +6 → ×1.050; +9 → ×1.076 (compound). Hard cap at +9 (max 3 tiers).
- Stacks **multiplicatively** with the Sprint 30 skill-talk boost (×1.05).

**TDD approach:**
1. Unit `tests/unit/sim/momentum.test.ts`:
   - `momentum(5, 1) === 2`; `momentum(0, 0) === 0`; `momentum(1, 1) === 0`; trailer always 0.
   - Tier function: `tier(2) === 0`, `tier(3) === 1`, `tier(8) === 2`, `tier(9) === 3`, `tier(15) === 3` (cap).
   - Skill multiplier: `skillMult(tier=2) === 1.025 * 1.025` (within float tolerance).
2. Engine integration `tests/unit/sim/momentumIntegration.test.ts`:
   - Force a state where Team A has +3 momentum; run 1000 rallies sampling Team A's first attack; observed attack rate within ±1% of `(baseline rate × 1.025)`.
3. Cross-set reset: after `setComplete` event, both teams' momentum drops to 0.

**Implementation:**
- Pure functions in `shared/src/sim/live/momentum.ts`: `computeMomentum(scoreA, scoreB)`, `tierFor(momentum)`, `skillMultiplier(momentum)`.
- `simulateRallyStep` calls `computeMomentum` post-rally and writes to `state.momentum`.
- Rally FSM consumes `state.momentum[team]` to multiply skill ratings before sampling. Plumbing change is small: existing FSM already accepts a `skillModifier` shape for the Sprint 19 coach-AI hook; reuse the same channel.
- UI: momentum bar component in scoreboard pane (Task 29.3).

**Acceptance:**
- [ ] All unit tests pass.
- [ ] Engine integration test confirms ±1% effect.
- [ ] Sim-only path (`simulateMatch`, no live state) unaffected — momentum is **off by default** in `simulateMatch` to preserve calibration determinism. Live-mode-only feature.
- [ ] Momentum visible in `LiveMatchState.momentum` after every rally.

**Calibration risk:** **Zero** if momentum is gated to live mode. **High** if it accidentally bleeds into `simulateMatch`. Add an explicit `simulateMatch` test asserting `state.momentum === undefined` is the path used.
**Schema risk:** None.
**Effort:** Small-Medium (~3 h).

---

### Task 29.3 — Live Play Hub UI (4-pane shell + sim controls)

**What:** New screen `LivePlayHub.tsx`, opened from Match Hub when the user clicks "Play" on a fixture (Task 29.4). 4-pane shadcn layout:

```
+------------------+----------------------+
| PBP ticker       | Scoreboard           |
| (top-left)       | + match stats        |
|                  | + momentum bars      |
|                  | (top-right)          |
+------------------+----------------------+
| My team stats    | Coaching strategy    |
| (per-player live)| (sim controls only   |
| (bottom-left)    |  this sprint)        |
+------------------+----------------------+
```

**Sim controls (bottom-right pane):**
- **Next point** — calls `match.live.playRallies(1)`.
- **Next 5** — `playRallies(5)`.
- **Next 10** — `playRallies(10)`.
- **End of set** — `playToSetEnd()`.
- **End of match** — `playToMatchEnd()` with smart-pause triggers.
- **Pause** — visible only mid-stepping; stops a multi-rally call.

**Smart pause triggers** (apply to "End of set" and "End of match" only):
- Set point reached for either team.
- Momentum swing of ≥3 in last 5 rallies.
- (Sprint 30: opponent calls timeout.)
- (Sprint 30: opponent makes a substitution.)
- End of set (always).

**TDD approach:**
1. Component `tests/unit/LivePlayHub.test.tsx`:
   - Mounts with mocked `match.live.getState` returning a fresh state.
   - All 4 panes render.
   - Click "Next 5" → IPC mock receives `playRallies(5)`.
   - axe-clean.
2. Visual-regression Playwright spec `tests/e2e/livePlayHub.spec.ts`:
   - Open save → start match in Live mode → assert 4-pane layout renders → step 5 rallies → assert score/PBP update.
   - axe via `axe-playwright` (CLAUDE.md "From Sprint 21" pattern).
3. Recharts mock pattern (CLAUDE.md "From Sprint 20") for any charts in scoreboard pane.

**Implementation:**
- `app/src/screens/LivePlayHub.tsx` — CSS grid 2×2; sub-components in `app/src/components/livePlay/`:
  - `PbpTickerPane.tsx` — reuse Sprint 19 `pbpFormat` prettifier; auto-scroll to bottom on new events.
  - `ScoreboardPane.tsx` — sets won, current set score, server indicator, momentum bars (one per team, 0–9 scale, tier markers at 3/6/9).
  - `MyTeamStatsPane.tsx` — per-player live K/E/A/hitting%, dig count. Uses `boxScore` from `LiveMatchState`.
  - `CoachingStrategyPane.tsx` — sim controls only this sprint (Sprint 30 adds timeout/sub buttons; Sprint 31 adds rotation).
- `app/src/store/useLivePlayStore.ts` — Zustand store; `state: LiveMatchState | null`, `playRallies(n)`, `playToSetEnd()`, `playToMatchEnd()`, `pause()`, `dispose()`.
- `app/src/match/livePlayController.ts` — drives async multi-rally calls with cancellation token (so Pause can stop "End of match" mid-flight).
- Module-level controller leak prevention (CLAUDE.md "From Sprint 19" Match Hub lesson) — `dispose()` clears the controller and any timers; `beforeEach` in tests must call `useLivePlayStore.getState().dispose()`.

**Acceptance:**
- [ ] 4-pane layout renders correctly at 1920×1080 and 1280×720.
- [ ] Sim controls call the right IPC for the right delta.
- [ ] PBP auto-scrolls; momentum bars animate.
- [ ] axe-core zero violations on the screen + every pane.
- [ ] `useLivePlayStore` resets cleanly between tests (no module leak).

**Calibration risk:** None (UI only).
**Schema risk:** None.
**Effort:** Large (~7 h — 4 panes, controller, tests, a11y).

---

### Task 29.4 — Match Hub launch CTA + IPC surface

**What:** Add the "Play" entry point on Match Hub, alongside existing "Sim" and "Watch Replay." Wire the `match.live.*` IPC handlers.

**TDD approach:**
1. Component test for Match Hub: fixture row for the user's team shows three buttons (Sim, Play, Watch Replay) when not yet played. Other-team fixture rows show only Sim. Resume CTA covered in Task 29.5.
2. Integration `tests/integration/match/liveLifecycle.test.ts`:
   - `match.live.start(matchId, seed)` creates state in main's `Map`, returns initial `LiveMatchState`.
   - `match.live.playRallies(matchId, 5)` advances state, returns new state.
   - `match.live.dispose(matchId)` removes from map.
   - Calling `playRallies` on disposed match returns error.
   - Calling `playRallies` on non-existent match returns error.

**Implementation:**
- `main/src/ipc/liveMatchHandlers.ts` (new):
  - `match.live.start(matchId, seed?)` — load Match + both teams + starters; build initial `LiveMatchState`; store in `liveMatchStateRegistry: Map<matchId, LiveMatchState>`.
  - `match.live.getState(matchId)` — read-only.
  - `match.live.playRallies(matchId, n)` — loops `simulateRallyStep` n times or until match finishes / smart-pause trigger.
  - `match.live.playToSetEnd(matchId)` / `match.live.playToMatchEnd(matchId)` — variants.
  - `match.live.dispose(matchId)` — remove from registry.
  - All calls return zod-validated `LiveMatchStateMessage`. CLAUDE.md "Critical rules" §IPC discipline.
- Registry lifecycle: cleared on `app.before-quit` after Task 29.5 auto-save fires.
- Match Hub button wiring: clicking "Play" navigates to `LivePlayHub` route with `matchId` query param; LivePlayHub mounts and calls `match.live.start(matchId)`.
- **Save-slot switch guard** (per user request): a new IPC `liveMatch.hasActive(): boolean` — `useSaveSlotsStore.switchSlot()` checks this, blocks the switch with a toast "Pause or Sim Rest first" if true.

**Acceptance:**
- [ ] User clicks Play → LivePlayHub opens with initial state.
- [ ] All IPC round-trips zod-validated.
- [ ] Save-slot switch blocked while live match active.
- [ ] Disposed match cleaned from registry; no leak across multiple match plays.

**Calibration risk:** None.
**Schema risk:** None (no DB writes this task; persistence is Task 29.5).
**Effort:** Medium (~3 h).

---

### Task 29.5 — Pause / Resume persistence + quit dialog

**What:** Persist `LiveMatchState` to DB so a user can quit mid-match and resume. Implement the user-specified quit dialog: **Return / Pause / Sim Rest**.

**Schema migration:**
- New columns on `Match`:
  - `liveStateJson` — nullable Text; serialized `LiveMatchState` when paused. Cleared when match completes or "Sim Rest" runs.
  - `coachActionsJson` — nullable Text; serialized `CoachActionLog[]`. Written for any match played in Live mode (even if not paused). Empty array `[]` for matches with no coach actions; `null` for sim-only matches. Sets the foundation for Sprint 30/31 actions and a future "Watch your match back" v1.x feature.
- Migration: `prisma/migrations/20261019_000000_match_live_state/migration.sql` (sprint-aligned future-dated, ~2 weeks after Sprint 28's `20261005`; CLAUDE.md "From Sprint 19" convention).
- Forward-compat (CLAUDE.md §6) — existing saves: both columns default to `null`; readers tolerate missing data.

**Quit dialog:**
- Triggers: user clicks back/nav-away, presses ESC at top level, closes window.
- Modal with three options:
  - **Return to match** — close dialog, no-op.
  - **Pause match** — call `match.live.pause(matchId)` (serializes state to `liveStateJson`), navigate away.
  - **Simulate rest** — call `match.live.simulateRest(matchId)` (runs live engine to completion with no further coach inputs, persists final box score, clears `liveStateJson`), navigate away.
- ESC dismisses to "Return to match" (don't trap user).

**Resume CTA:**
- Match Hub fixture row with `liveStateJson != null` shows a yellow **Resume Live** button instead of (or in addition to) Sim/Play. Click → navigates to LivePlayHub which calls `match.live.resume(matchId)` (loads state from DB into registry).

**Auto-save on app quit:**
- Listen `app.before-quit` in `main/src/index.ts`.
- For every entry in `liveMatchStateRegistry`, persist to `liveStateJson` synchronously (Prisma `$transaction([...])` array form; CLAUDE.md "From Sprint 13").
- Crash recovery is best-effort — same Sprint 23 crash-recorder philosophy. Note in spec, don't engineer for it.

**TDD approach:**
1. Integration `tests/integration/match/livePauseResume.test.ts`:
   - Start live match → play 30 rallies → call `pause` → verify `liveStateJson` populated → call `resume` → state matches pre-pause exactly.
   - Resume → play to completion → final box score equals what `simulateMatch(seed)` would have produced (assuming no coach actions).
   - "Sim Rest" mid-match → final box score deterministic given (seed, current state); `liveStateJson` cleared; `coachActionsJson` preserved.
2. Quit-dialog component test:
   - Each button fires correct action.
   - ESC = Return.
   - axe-clean.
3. Auto-save test: simulate `app.before-quit` event with active match in registry → DB row updated.
4. Save-slot switch guard test (cross-references Task 29.4).

**Implementation:**
- IPC additions:
  - `match.live.pause(matchId)` — serializes registry state to DB, removes from registry.
  - `match.live.resume(matchId)` — loads DB state into registry.
  - `match.live.simulateRest(matchId)` — calls `simulateRallyStep` to completion with no `coachInputs`, writes final box score + PBP via existing persistence path, clears `liveStateJson`.
  - `match.live.hasPaused(matchId): boolean` — for Match Hub Resume-CTA visibility.
- `app/src/components/QuitMatchDialog.tsx` — three-button modal.
- `app/src/screens/LivePlayHub.tsx` — wires the dialog into nav-away guards (React Router `useBlocker` or equivalent).
- `app.before-quit` handler in `main/src/index.ts` — auto-pause every active match.

**Acceptance:**
- [ ] Migration applied on test DBs without errors; idempotent re-apply via `applyMigrations` (CLAUDE.md "From Sprint 25").
- [ ] Pause → Resume produces identical state.
- [ ] Sim Rest produces deterministic final state.
- [ ] App quit with active match → DB has `liveStateJson` populated.
- [ ] Resume CTA appears on Match Hub for paused matches.
- [ ] Old saves (no `liveStateJson` column data) load without error.

**Calibration risk:** Low. "Sim Rest" path uses live engine (with momentum); calibration uses `simulateMatch` (without). Document the divergence in `docs/calibration/tuning-log.md`.
**Schema risk:** Medium — new columns. Forward-compat verified by CLAUDE.md §6 contract.
**Effort:** Large (~6 h).

---

### Task 29.6 — Coach actions log scaffolding (write-only)

**What:** Define the `CoachActionLog` type and start writing entries to `coachActionsJson` for every live match. No reads / replays this sprint — Sprint 30/31 actions populate it; Sprint 31 "key rally" notification consumes it; v1.x replay feature renders it.

**TDD approach:**
1. Unit: type round-trips through zod schema.
2. Integration: live match played to completion → `coachActionsJson` is `[]` (no actions in Sprint 29) — proves the write path is wired.

**Implementation:**
- `shared/src/sim/live/coachActions.ts`:
  ```ts
  export type CoachAction =
    | { kind: 'timeout'; team: 'A'|'B'; rallyIndex: number; skill?: SkillKey }
    | { kind: 'substitution'; team: 'A'|'B'; rallyIndex: number; out: string; in: string }
    | { kind: 'rotation'; team: 'A'|'B'; setIndex: number; rotation: RotationState; system: '5-1'|'6-2'; libero: string; hint: 'aggressive'|'balanced'|'defensive' };
  ```
- `LiveMatchState.coachActionLog: CoachAction[]` — accumulated; serialized into `Match.coachActionsJson` on match completion or pause.
- Sub-path export at `@vcd/shared/sim/live/coachActions`.

**Acceptance:**
- [ ] Schema defined + zod-validated.
- [ ] Empty array written for Sprint 29 live matches.
- [ ] Sprint 30/31 can append without schema changes.

**Calibration risk:** None.
**Schema risk:** None (column added in Task 29.5).
**Effort:** Small (~1 h).

---

### Task 29.7 — Documentation + invariants

**What:** Update CLAUDE.md and PRD to reflect the new live mode.

**Edits:**
1. **CLAUDE.md §Critical rules #2 (Determinism)** — append: "The live-play driver (`simulateRallyStep`) is deterministic given `(state, coachInputs)`. The one-shot `simulateMatch` driver remains deterministic by `seed` alone and is the only path used by calibration."
2. **CLAUDE.md §Critical rules #4 (Invariants)** — add:
   - "`Match.liveStateJson` is non-null only when a match is paused mid-play. Clears on completion or Sim Rest."
   - "`coachActionsJson` is `null` for sim-only matches; `[]` or non-empty array for any match played in Live mode."
3. **CLAUDE.md "Gotchas"** — Sprint 29 retro will add the lesson section. Include a placeholder header at sprint close.
4. **PRD §5** — add Sprint 29 entry referencing this spec; add Sprint 30 + 31 placeholders.

**Acceptance:**
- [ ] All edits land in the same PR as Task 29.1+ code.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **29.1** (incremental driver) — foundation; everything depends on it.
2. **29.2** (momentum) — pure addition to driver; minimal UI.
3. **29.6** (action log scaffolding) — small, unblocks 29.5.
4. **29.5** (pause/resume + migration) — critical-path, schema risk.
5. **29.4** (IPC + Match Hub button) — needs 29.1 + 29.5.
6. **29.3** (Live Play Hub UI) — needs 29.4 IPC; biggest UI work.
7. **29.7** (docs) — final.

29.1 + 29.2 can be done in parallel by the same person (small surface). 29.3 is the long pole.

---

## 6. Performance budget watch

| Surface | Budget | Sprint 29 status |
|---|---|---|
| Single match sim < 150 ms | unchanged | ✅ `simulateMatch` untouched |
| `simulateRallyStep` per call | new — < 5 ms | ⚠️ verify with bench |
| Live match step → UI render | new — < 50 ms p95 | ⚠️ measure on Playwright run |
| Save-file ≤ 35 MB / 10 seasons (Sprint 23 bar) | unchanged for sim-only matches | ⚠️ live matches add ~10–30 KB per match (`liveStateJson` peak before clear); negligible long-term since cleared on completion |
| `coachActionsJson` per live match | new — < 5 KB | ✅ small JSON |

Run `npm run bench` before sprint close.

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` passes.
- [ ] `npm run test:calibration:full` **unchanged** (incremental driver does not affect sim-only path).
- [ ] axe-core zero violations on LivePlayHub.
- [ ] PR includes CLAUDE.md + PRD updates.
- [ ] Manual UAT: user plays one full match end-to-end via Live mode (3 sets); pauses mid-set 2, resumes; quits + relaunches app, finds Resume Live CTA, finishes the match.
- [ ] Sprint 29 retro authored at `docs/retros/sprint-29-retrospective-{date}.md`.
- [ ] Tagged `sprint-29-complete`.

---

## 8. Out of scope (Sprints 30 + 31)

- **Sprint 30:** Timeouts (NCAA 2/set, halve opponent momentum, skill-talk picker, +5% boost, duration `5 + round(HC.strategy/10)` floored at 7); substitutions (15-cap, libero auto-handled); opponent-TO smart-pause hookup.
- **Sprint 31:** Pre-set rotation editor (order + system + libero + one tactical hint per system); visual rotation tracker; real-volleyball positional engine wiring (front-row attack ×1.10, back-row attack cap, back-row pass ×1.10, 6-2 setter rotation); "key rally" smart-pause notification; calibration verification; full a11y pass.

Other v1.x deferrals:
- "Watch your live match back" replay (uses `coachActionsJson` — populated this sprint, consumed in v1.x).
- Network/multiplayer (PRD §2 — never).
- Coach AI making *suggestions* during live play (e.g., "consider a timeout — opponent on 4-0 run"). Possible v1.2.
- Visual coach portrait + speech bubble during timeouts (cosmetic).
