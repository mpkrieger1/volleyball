# CLAUDE.md

Guidance for Claude Code when working in the NCAA Volleyball Coach Dynasty (VCD) repository.

---

## Project at a glance

**VCD** is a single-player career-coach dynasty simulation for NCAA Division I Women's indoor volleyball. Electron desktop app (Windows-first), rally-by-rally sim engine, full 2026 D-I league with all ~340 programs, 64-team NCAA bracket, recruiting + transfer portal + NIL, AVCA All-American awards.

- **Solo dev:** Matt
- **Target v1 release:** 2027-04
- **Plan:** 26 two-week sprints — see `PRD.md` §5 for per-sprint deliverables and exit tests.
- **Working title:** NCAA Volleyball Coach Dynasty (VCD)
- **Inspiration:** Football Coach: College Dynasty (FCCD) — structural reference only, **not** a code/asset source. See PRD §6.5.

Read `PRD.md` before any non-trivial change. The PRD is the single source of truth for scope, architecture, data model, and sprint exit criteria.

---

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Electron (latest LTS) |
| UI | React + TypeScript, Vite build |
| State | Zustand |
| DB | SQLite via Prisma ORM |
| Sim | Node worker threads (`simWorker`, `seasonWorker`, `recruitingWorker`) |
| Packaging | electron-builder (NSIS installer, Windows) |
| Charts | Recharts or Visx |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Lint / format | ESLint + Prettier |
| CI | GitHub Actions |

---

## Repo layout

```
/app         # Renderer: React SPA
/main        # Electron main process
/workers     # Node worker threads (sim, season, recruiting)
/prisma      # schema.prisma, migrations, seed scripts
/shared      # Types, zod schemas, IPC contracts shared across processes
/assets      # Logos, fonts, placeholder art
/tests       # E2E (Playwright) and integration suites
/docs        # PRD.md, sprint notes, ADRs
```

IPC between renderer and workers is strictly typed via zod schemas in `/shared`. Do not send untyped messages across the process boundary.

---

## Commands

```bash
# Install
npm install

# Dev (Electron + Vite HMR)
npm run dev

# Production build
npm run build

# Tests
npm run test             # Vitest unit + integration
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright
npm run test:calibration # Full-season sim vs benchmark CSV (slow; nightly in CI)

# DB
npm run prisma:migrate   # Run pending migrations
npm run prisma:reset     # Drop + reseed (destroys local data)
npm run seed             # Seed 2026 D-I league

# Quality gates
npm run lint
npm run typecheck
npm run format
```

Before opening a PR: `npm run lint && npm run typecheck && npm run test && npm run build` must all pass locally. CI runs the same plus Playwright.

---

## Critical rules

### 0. Tool-use discipline (read this BEFORE writing any code)

These three rules have bitten Sprints 33–36 every single time. They are
operator-error patterns, not codebase issues. Read them before each
non-trivial Edit/Write batch.

- **Edit tool requires a prior Read of the same file in the current session.** Failure mode: `File has not been read yet`. In batched parallel calls the error is easy to miss; a subsequent passing typecheck does NOT prove the edit landed (it can pass because the missing wiring is net-additive). Pair every Edit with a Read of the same file in the same or a recent batch. After issuing critical Edits, spot-check via `grep` for the added symbol.
- **Write tool only takes `file_path` + `content`.** Edit tool only takes `old_string` + `new_string` + `replace_all`. Adding Edit-style params to a Write call returns `InputValidationError` and the file is NOT created. The two APIs look similar but are different.
- **Prisma `$queryRawUnsafe` returns `bigint` for INTEGER columns.** Vitest's `expect(...).toBe(0)` uses Object.is which fails on `0n !== 0`. Use `.toEqual(0n)` or coerce via `Number(...)` when asserting against PRAGMA / raw SQL output.

### 1. FCCD is reference — personal-use project

VCD is a personal/non-commercial project (Matt, single dev, never sold). Football Coach: College Dynasty is installed locally and may be referenced freely as a design source for layout, copy patterns, info hierarchy, interaction model, and inputs. The clean-room rule that previously appeared here was based on commercial-distribution risk that does not apply. Do not redistribute FCCD assets even so — keep raw asset files (PNGs, audio, fonts, `.asar` contents) out of the VCD repo. Reproducing screen designs, copying field names, mirroring flows, etc. is fine.

### 2. Determinism

The sim is deterministic given a seed. Every RNG call must go through the seeded RNG utility in `/shared/rng.ts` — never `Math.random()` in sim or scheduler code. Tests rely on this. A flaky test in sim/season/schedule code is almost always someone reaching for `Math.random()`.

**Sprint 29 amendment:** the live-play driver (`simulateRallyStep` in `workers/src/sim/live/`) is deterministic given `(state, coachInputs)`. The one-shot `simulateMatch` driver remains deterministic by `seed` alone and is the only path used by calibration. Live-mode features (live momentum, future Sprint 30/31 coach actions) are gated by `LiveMatchState.kind === 'live'` AND opt-in flags (`useLiveMomentum`) so they NEVER affect `simulateMatch` output. Byte-equality between `simulateMatch(seed)` and `simulateMatchLive(seed, [])` (no coach actions, momentum off) is a CI-enforced invariant.

### 3. Golden fixtures

Rotation engine, rally FSM, scheduler, and bracket builder all have golden-file tests. If you change their outputs, **intentionally** regenerate fixtures in a dedicated commit with a message explaining why — don't silently update them to make a failing test pass.

### 4. Invariants that must always hold

These are tested in CI; treat a violation as a P0 bug, not a test bug.

- Sum of per-player kills in a box score == team kills on the scoreboard.
- PBP log replayed through the pure reducer reproduces the box score exactly.
- No player exists on two teams' rosters at the same tick.
- No team scheduled for two matches on the same date.
- Every team plays exactly 10 non-conference games before any conference games begin (Sprint 28: weeks 0–4 are non-con only; weeks 5–13 are conference only).
- Conference game count per team ≤ 18, generated via capped circle-method (`MAX_CONF_ROUNDS_PER_TEAM = 9` then mirror). Even-sized confs ≥10 give every team exactly 18; odd-sized confs ≥10 give most teams 18 with a small (≤2-game) asymmetry from the bye rotation; confs <10 play full double round-robin = `(N−1) × 2` games (Sprint 28).
- Every tournament outcome is persisted in a `Match` row with `isTournament = true`.
- Every team has an HC slot filled at every tick (auto-backfill on vacancy).
- (Sprint 29) `Match.liveStateJson` is non-null only when a match is paused mid-live-play. Cleared on completion or "Sim Rest." Schema = `LiveMatchStateSchema` in `@vcd/shared/sim/live/state` (re-exported from the `sim` namespace).
- (Sprint 29) `Match.coachActionsJson` is `null` for sim-only matches; `'[]'` or non-empty JSON array for any match played in Live mode (even with no coach actions). Schema = `CoachActionLogSchema` in `@vcd/shared/sim/live/coachActions`.
- (Sprint 30) Live mode: each team capped at **2 timeouts per set** (NCAA-accurate). Counter resets at set start. User TO halves opponent continuous momentum (`TIMEOUT_MOMENTUM_RESET_FACTOR=0.5`).
- (Sprint 30) Live mode: each team capped at **15 substitutions per set** (NCAA). Libero swaps do not count and are auto-handled by the rotation engine — direct user subs at the libero slot are rejected with `LIBERO_SLOT_SWAP_NOT_ALLOWED`.
- (Sprint 30) Live mode: skill-talk boost duration = `max(7, 5 + round(HC.strategy / 10))` points. Boost stacks **multiplicatively** with live-mode momentum tier bonus. A second timeout with a different skill REPLACES the existing boost.
- (Sprint 31) Live-mode positional rules (front-row attack ×1.10, back-row pass ×1.05/1.10/1.15 by hint, 5-1 setter dump under defensive hint at 3%) are gated by `LiveMatchState.useLivePositionalRules` AND `kind === 'live'`. The `simulateMatch` driver is unaffected and remains calibration-deterministic — verified by `tests/unit/sim/live/positionalRules.test.ts` byte-equality block.
- (Sprint 31) Rotation validation: 5-1 setter and OPP must be at opposite slots (P1↔P4, P2↔P5, P3↔P6); 6-2 has two setters at opposite slots; libero must be at a back-row slot (P1, P5, or P6). Validated by `shared/src/sim/live/rotationValidation.ts`.
- (Sprint 31) Back-row attacks are NOT modeled in v1.1 — the rally FSM treats any back-row attack attempt as a `rotation_violation` point loss (Sprint 4 behavior). The "back-row attack cap" feature in the Sprint 31 spec is therefore inert and deferred to v1.2 along with proper back-row attack mechanics.
- (Sprint 32) Training gain range follows FCCD's curve: `maxScale = floor(potential/10) − 1`; per-attribute multiplier `lineFunc(40,1.5,100,0.25)(currentRating)` clamped to [0,2]; floor = `getFacilitiesBaseGain(facilitiesLevel)` or 1 when focused. Defined in `shared/src/offseason/trainingGain.ts`.
- (Sprint 32) Repeated-focus penalty: 1× / 0.6× / 0.4× / 0.2× for the 1st / 2nd / 3rd / 4th+ focus on the same attribute in the same offseason event. Defined in `shared/src/offseason/repeatedFocusMultiplier.ts`.
- (Sprint 32) `Player.potential` remains a single integer. There are NO per-skill potential columns; per-attribute soft caps emerge organically from the gain curve (deliberate FCCD-mirror; rejected the original 9-column proposal).
- (Sprint 32) `Team.facilitiesLevel` is an integer 1..10 seeded by prestige tier (≥90→7, ≥75→5, ≥50→4, else 3). Legacy saves get bumped on `openSaveSlot` via `backfillFacilitiesLevel`; idempotent because rows already above 3 are skipped.
- (Sprint 33) Offseason is an 11-event sequence: YEAR_SUMMARY → COACH_LEVELING → COACH_CAROUSEL → PLAYERS_LEAVING → PLAYERS_TRANSFERRING → RECRUITING_1/2/3 → SIGNING_DAY → BOOSTER_UPDATES → ADVANCE_YEAR. Preseason is a 5-event sequence: POSITION_CHANGES → TRAINING_FOCUS → TRAINING_RESULTS → GAMEPLAN → FINALIZE. The user advances one event at a time via `advanceOffseasonEvent`. `runOffseason` is now a thin loop that walks every remaining event.
- (Sprint 33) Training gains apply ONCE per year at the TRAINING_RESULTS event, not per-week. Each coach (HC/AHC/AC) has 3 attribute focus slots → 9 picks per team. AI teams get picks generated lazily by `pickAiFocusesForCoach`. The Sprint 32 curve drives gains; the repeated-focus multiplier (1×/0.6×/0.4×/0.2×) is applied to the gain amount AND the breakthrough chance.
- (Sprint 33) Recruiting cycle scope: opens at RECRUITING_1, closes at SIGNING_DAY. NOT open during regular season. Portal: opens + resolves + closes inside PLAYERS_TRANSFERRING (one event call; no week-by-week portal sub-loop in v1.2).
- (Sprint 33) The Sprint 31 retro auto-open-recruiting-after-portal behavior is rolled back. `closePortal` no longer writes Season.phase or auto-opens the recruiting cycle. Phase management belongs to `advanceOffseasonEvent` exclusively.
- (Sprint 33) Per-event handlers are individually idempotent (key on PlayerArchive/CoachingPool/TrainingResultEntry rows for the season). `applyTrainingResults` no-ops if any TrainingResultEntry exists for the year.
- (Sprint 34) Practice focus is a per-week sim modifier, NOT a rating mutation. Each regular-season week the user picks one offensive + one defensive focus; AI teams use the auto-heuristic against opponent tendencies. The modifier (~3-5%) is applied at match start in the rally FSM via `applyBonus` on the relevant outcome key; ratings are unchanged.
- (Sprint 34) Calibration invariant: `simulateMatch(seed)` with NO modifier OR with the IDENTITY modifier produces byte-equal output to the pre-Sprint-34 path. `applyBonus` short-circuits via `bonus === 1 → return dist (by reference)` so allocation/normalization never run on the IDENTITY path. Verified by `tests/unit/sim/practiceFocusDeterminism.test.ts` across 100 random seeds.
- (Sprint 34) v1.2 has NO per-match in-season skill drift. Ratings only change at the offseason TRAINING_RESULTS event (Sprint 33). The original Sprint 34 "Gaussian per-match drift" design is rejected because it has no FCCD analogue.
- (Sprint 35 → 37) Recruit interest is computed on demand from `priorities × team.attributeLevels` via `computeRecruitTeamInterest` in `shared/src/recruiting/priorityModel.ts`. The legacy `computeBaseInterest` was a 0..1000-magnitude wrapper retained for one sprint; **Sprint 37 deleted it**. The bridge that survives is `computeRecruitTeamInterestScaled` in `shared/src/recruiting/interestModel.ts` — same priority-helper math, × 10 magnitude scale, plus the Sprint 28 star-prestige floor penalty. Sprint 13 commit-resolution thresholds (`HOT_INTEREST_THRESHOLD = 600`, `INTEREST_FLOOR = 30`, `interest^5` weighting in `pickCommittingTeam`) are unchanged.
- (Sprint 35) Recruit priorities are deterministic per `recruit.id` via `priorityFromId(id)`. Legacy-save backfill regenerates priorities idempotently from the id hash.
- (Sprint 35) Scout-tier reveal: `RecruitInterest.scoutLevel` (0..3) maps to LOCKED / PARTIAL / FULL projections via `projectRecruitDetail` in `main/src/recruiting/scoutReveal.ts`. The renderer must handle missing `ratings` / `potential` fields defensively (Sprint 36 wires the modal UI).
- (Sprint 35) `Team.academicsLevel` (0..100) and `Coach.hometownState` (2-letter US code) are seeded at league build (academics CSV) and synthesized for legacy saves via `backfillRecruitingCore` on `openSaveSlot`. Academics is a reserved priority slot for v1.3 — not weighted in the Sprint 35 interest formula. hometownState is consumed by Sprint 36's CoachConnection pitch reason.
- (Sprint 36) Pitch-reasons total + NIL points are bonus add-ins to `computeRecruitTeamInterest`. Combined cap = `MAX_BONUS_POINTS` = 150. Pitch reasons cap separately at 75 (`MAX_TOTAL_PITCH_BONUS`); NIL caps at 200 (`MAX_NIL_POINTS`). The `pitchBonusPoints` and `nilBonusPoints` are caller-computed and passed via the helper's optional args.
- (Sprint 36) Recruiter Quality is derived per call from `Coach.ratingRecruit` thresholds [85, 70, 55, 0]. Multipliers `[2.0, 1.66, 1.33, 1.0]`. Helper: `shared/src/recruiting/recruiterQuality.ts`. The picked recruiting coach (via `pickCoachRating`) gets the multiplier applied to their contribution inside `computeRecruitTeamInterest`.
- (Sprint 36) Team `nilBudgetCents` refreshes at SIGNING_DAY each cycle (`deriveNilBudget(prestige)` — $30k floor, $300k ceiling, 6-tier table). `nilBudgetUsedCents` tracks running spend; reset to 0 at the same SIGNING_DAY. The `setNilOffer` IPC handler updates both atomically using DELTA semantics (decrement old offer, increment new).
- (Sprint 36) Pitch reason `active` flags are deterministic per `recruit.id` via `createRng('pitch:${recruit.id}')`. Different recruits respond to different pitches; no state change between sessions. WantsToWin (~30% of recruits) → CoachPedigree always active. CoachConnection 75% baseline activation.
- (Sprint 36) HC championship history (for CoachPedigree) is derived from `Season.nationalChampionTeamId` joins + `Match.tournamentRound==='CT_F' AND winnerId === teamId` aggregations, NOT from the `Award` table. v1.2 attributes ALL team championships within `Coach.hireSeason..now` to the current HC (no HC-history audit table); v1.3 may refine.

### 5. Performance budgets (PRD §3.5)

- Single match sim: **< 150 ms**
- Full week (~170 matches, parallel): **< 8 s**
- Regular-season advance (13 weeks): **< 2 min**
- Save file after 10 seasons: **< 25 MB**

If a change makes any of these regress, the change is not done. Profile first, optimize second — a `npm run bench` script wraps the hot paths.

### 6. Save-file compatibility

Prisma migrations must be forward-compatible. A save created in sprint N must open in sprint N+1. When renaming a column, write a migration that preserves data; don't just rename in `schema.prisma` and reset.

### 7. Accessibility

Every user-facing screen must pass axe-core with zero violations (PRD Sprint 21 sets this as the bar for polish screens; apply it to all new screens from the start). Keyboard navigation is not optional.

### 8. Scope discipline

v1 is D-I Women's indoor only. If a PR starts adding men's, beach, D-II, multiplayer, Hall of Fame, or conference realignment — stop. Those are v2 backlog items. See PRD §2 for the in/out-of-scope list.

---

## Sprint discipline

The PRD decomposes the 12-month roadmap into 26 sprints, each with a goal, deliverables, and exit tests. When working in a sprint:

- Check `PRD.md` §5 for the current sprint's exit tests before starting work.
- A sprint is not "done" until every exit test passes in CI and the build is tagged in git.
- Demoable milestones land in Sprint 6, Sprint 18, and Sprint 26 — don't let scope creep in those sprints; they are the user-visible vertical slices.

---

## Data model conventions

See PRD §3.3 for the full Prisma entity list. Conventions:

- Primary keys are `cuid()` strings, not autoincrement integers (save-file portability).
- Money, NIL amounts, salaries: integers in cents, never floats.
- Ratings: integers 0–100. Potential is a separate 0–100 integer, not a modifier.
- Dates in the DB are ISO 8601 strings in UTC; convert at the UI edge only.
- JSON columns (`Match.pbp`, `Match.boxScore`) have zod schemas in `/shared` — validate on read and on write.

---

## Testing philosophy

- **Unit tests (Vitest):** pure functions — probability tables, RPI math, rotation legality, AA selection. Fast, deterministic, no DB.
- **Integration tests (Vitest + temp SQLite):** worker round-trips, week advance, season advance, save/load cycles.
- **Golden-fixture tests:** rally FSM, rotation engine, scheduler, bracket builder. Fixtures live in `/tests/fixtures/` and are regenerated only intentionally.
- **E2E (Playwright):** full user flows — create save, sim a match, recruit a class, advance a season, view analytics.
- **Calibration suite:** full simulated season compared to the real 2024–25 NCAA benchmark CSV. Runs nightly in CI, not on every PR (slow).

When adding sim logic, add a unit test with a seeded RNG and a Monte Carlo expectation (see Sprint 3 exit tests as the template: "10,000 rallies, side-out rate within ±3%").

---

## Git & PR conventions

- Branch names: `sprint-NN/short-description` (e.g., `sprint-04/libero-replacement`).
- Commit messages: imperative mood, reference the sprint and the exit test being addressed when applicable (`S4: enforce 15-sub cap per set (exit test 3)`).
- Every PR must: pass CI, reference which sprint exit test(s) it advances, and update the PRD if scope shifts.
- Tag the end of each sprint with `sprint-NN-complete`.

---

## When something isn't in the PRD

If a task lands that the PRD doesn't cover — a new screen, a scope change, a new data field — pause and either:

1. Update the PRD in the same PR, with a note in the PR description explaining the scope shift, or
2. Flag the mismatch and ask before writing code.

Silent scope drift is the biggest risk on a solo-dev 12-month timeline (PRD §7).

---

## Gotchas accumulated

Lessons from prior sprint retros — kept tight, organized by topic. Per-sprint detail lives in `docs/retros/`.

### Tool-use discipline (operator errors that bit Sprints 33-35)
- **Edit tool requires a prior Read of the same file in the current session.** Failure mode: `File has not been read yet`. In batched parallel calls the error is easy to miss; a subsequent passing typecheck does NOT prove the edit landed (it can pass because the missing wiring is net-additive). Pair every Edit with a Read of the same file in the same or a recent batch. Spot-check critical edits via `grep` for the added symbol before declaring done.
- **Write tool only takes `file_path` + `content`. Edit tool only takes `old_string` + `new_string` + `replace_all`.** Adding Edit-style params to a Write call returns `InputValidationError` and the file is NOT created. The two APIs look similar but are different.
- **Prisma `$queryRawUnsafe` returns `bigint` for INTEGER columns.** Vitest's `expect(...).toBe(0)` uses Object.is which fails on `0n !== 0`. Use `.toEqual(0n)` or coerce via `Number(...)` when asserting against PRAGMA / raw SQL output.

### Build / module resolution
- **`/shared` emits CommonJS.** Electron main + Node workers consume via `require`; Vite reads source through the `@vcd/shared` alias. Don't flip shared to ESM without coordinating every consumer.
- **Cross-workspace imports go through `@vcd/shared`** (or the package name). Never relative `../../shared/src/...` — typechecks but fails at runtime. ESLint enforces.
- **`@vcd/shared` exports are namespaces.** Anything under `shared/src/<module>/index.ts` is reached as `<module>.X` — e.g., `crash.CrashRecord`, not `CrashRecord`.
- **Anything in `shared/src/` that imports a Node-only module MUST live behind a sub-path export AND must NOT be re-exported from any barrel reachable from the renderer.** Sprint 19/25 history: `pbpCodec.ts` (`node:zlib`) and `perf/timer.ts` (`node:fs`) leaked through barrels into the renderer bundle and broke `npm run build`. Recipe: add the module to `shared/package.json` `exports` map (e.g. `@vcd/shared/seed`), drop it from the top-level barrel, import via the sub-path. Or use a lazy `require('node:fs')` inside the function.
- **Cyclic imports through a barrel cause Electron-renderer black-screen.** If a file under a barrel imports a VALUE from a sibling under the same barrel, ESM (Vite/Electron) hits TDZ; CJS (Vitest) tolerates it. Put the shared value in a leaf module that the barrel does NOT re-export. Type-only imports are safe (erased at runtime). Sprint 31: extracted `SkillKeySchema` to `shared/src/sim/live/skills.ts`.
- **Sub-path aliases must be regex-anchored.** Sprint 19 added a string alias `'@vcd/shared/seed'` that greedily prefix-matched `@vcd/shared/seed/leagueSeed`. Use anchored regex aliases in BOTH `app/vite.config.ts` AND `vitest.config.ts`, most-specific FIRST: `[{find: /^@vcd\/shared\/seed$/, ...}, {find: /^@vcd\/shared(\/.*)?$/, ...}]`.
- **`composite: true`** (from `tsconfig.base.json`) forbids `noEmit`. For Vite-built workspaces use `emitDeclarationOnly: true` with a dedicated `outDir` (e.g., `.tsbuild`).
- **Root tsconfig references:** only list a workspace when its `tsconfig.json` exists — `tsconfck` crashes with ENOENT otherwise.
- **`tsc -b` + stale `.tsbuildinfo`** can silently skip declaration emit. Delete `*.tsbuildinfo` (or `--force`) after changing module/target/outDir.
- **Migration timestamps are sprint-aligned future-dated**, not wall-clock. After `prisma migrate dev --create-only`, rename the directory to a timestamp AFTER the most recent existing migration. Wall-clock timestamps can disorder `migrate deploy` on fresh DBs.

### Testing
- **Vitest + JSX:** `vitest.config.ts` must include `@vitejs/plugin-react`. Without it, `.tsx` tests fail with `ReferenceError: React is not defined`.
- **Testing Library cleanup** requires explicit `afterEach(cleanup)` in setup; auto-cleanup is off because Vitest globals are off.
- **Zustand stores are module singletons.** Reset in `beforeEach` for component tests — DOM cleanup doesn't touch store state.
- **axe-core requires visible text in `<th>`.** `aria-label` on an empty header triggers `empty-table-header`; use visible text (+ visually-hidden utility if needed). Pattern: `expect(results.violations).toEqual([])`, NOT `toHaveNoViolations()` (matcher extension isn't registered).
- **Recharts `ResponsiveContainer` doesn't render in jsdom.** Tests mounting Recharts must `vi.mock('recharts')` and stub `ResponsiveContainer` with a fixed-size `<div>`. Canonical: `tests/unit/AnalyticsView.test.tsx`.
- **Perf tests with wall-clock thresholds run via `npm run test:perf`** (chained vitest invocations) and are excluded from the default suite. `weekPerf` and `memoryLeak` flake under concurrent workers; the 8s budget has only ~38% headroom.
- **`global.gc()` requires `--expose-gc`** — memory-leak tests use `cross-env NODE_OPTIONS=--expose-gc`. Without it, snapshots are noisy.
- **axe-playwright is the live-Electron a11y tool** (`npm run test:a11y-e2e`). Use `injectAxe(window)` + `checkA11y(window, 'main', {...})`. Template: `tests/e2e/programBuildingA11y.spec.ts`.
- **Calibration tests use `it.skipIf(!benchmarkIsReal())` for PRD assertions.** `prisma/benchmarkData/ncaa-2024-25-stats.csv` ships as a STUB (token in a comment line); `parseBenchmarkCsv` returns `{ok: true, stub: true}`; tests skip + log instead of failing.
- **Recurring Monte Carlo flakes were widened, not fought:** Sprint 9 poll-overlap (≥4 → ≥3), Sprint 13 top-5 stars (≥2.8 → ≥2.7). Single-season snapshots have inherent ordering noise; the loosened threshold still preserves the invariant.

### Electron / OS
- **Dev-mode gate is `process.env.VCD_DEV === '1'` ONLY** — never `!app.isPackaged`. Playwright `_electron.launch()` otherwise tries to hit the Vite dev server.
- **Electron sandboxed preloads can't `require('@vcd/shared')`.** We run `webPreferences.sandbox: false`; `contextIsolation: true` + `nodeIntegration: false` provide the security envelope. Re-enable sandbox only after bundling preload as self-contained.
- **`Window['vcd']` is declared in exactly one place** — `app/src/types/window.d.ts`. Don't scatter `declare global` across stores.
- **Playwright swallows main-process stderr on crash.** First place to look: file logger at `<userData>/vcd-main.log`.
- **Playwright `getByRole` matches accessible names as substring by default.** When two buttons share a substring, use `exact: true` or scope via `within(...)`. Don't put `role="button"` on a `<tr>` — overrides the implicit `role="row"` and concatenates all `<td>` text into the accessible name.
- **Prisma CLI is fragile on spaced paths (OneDrive, "Program Files").** For per-DB migration apply, read `migration.sql` and run statements via `prisma.$executeRawUnsafe`. Strip `--` comment lines BEFORE splitting on `;`.
- **`npm run clean` wipes workspace symlinks on Windows.** The rimraf glob errors mid-run, leaving `node_modules/@vcd/` empty. Recovery: `npm install` then rebuild shared/workers. Prefer targeted deletion until hardened.
- **Background command monitoring:** `npm test 2>&1 | tail -50` doesn't always flush through the pipe buffer. Redirect to file (`> output.log`) and grep the file directly.

### Data / Prisma / SQLite
- **Don't wrap 1000+ updates in an interactive `$transaction(async (tx) => ...)`** — Sprint 13 hit a silent partial-commit failure at ~3,600 sequential updates. Use direct `client.x.update` calls or the array form `client.$transaction([promise1, ...])`. Array form does NOT accept `maxWait`/`timeout`.
- **`$transaction` default timeout is 5 seconds.** For heavy atomic writes (advanceWeek does ~3000 queries), pass `{maxWait: 30_000, timeout: 60_000}`.
- **Don't `Promise.all` 100+ parallel SQLite writes.** For >100 row inserts, use `createMany` (no ids back) or serial creates (ids back).
- **N+1 queries in Prisma hot paths** — when a loop does `findMany` per iteration, load once and group via `Map<id, Row[]>`. Sprint 13 went from ~20s/week to ~1s/week on this single refactor.
- **Stale-snapshot iteration loops need a "repair" phase** — any read-then-write loop where world drifts between iterations needs a reconciliation step. Sprint 13 board-replenish + Sprint 9 inertia rewrite are the same lesson.
- **Prisma relation filters on mutated fields are fragile.** When a filter depends on row state that changes during the loop, pull the id list first and use `id IN (...)`.
- **SQLite `VACUUM` cannot run inside a transaction.** Call via `client.$executeRawUnsafe('VACUUM')` AFTER the prune transaction closes.
- **`PlayerMatchStat.player` is `onDelete: Cascade`** (Sprint 25). Pre-Sprint-25 was RESTRICT — explicit `tx.playerMatchStat.deleteMany` calls in deletion paths are now defensive but no longer load-bearing.
- **PBP encoding** — `Match.pbpEncoding` is `'json'` (legacy ≤S22), `'gzip-base64'` (S23+), or `'pruned'`. Always read via `sim.decodePbp(payload, encoding)`. Never `JSON.parse(row.pbpJson)` directly.
- **`runOffseason` runs `pruneOldSeasons` automatically** with `retainSeasons=1`, `retainArchiveYears=3`. Older regular-season Match rows are deleted (cascades to Set + PMS); older tournament rows keep metadata but lose `pbpJson`.
- **`computeBoardScore` (board ranking) and `computeRecruitTeamInterestScaled` (persisted interest) are intentionally different.** Don't swap one for the other — `computeRecruitTeamInterestScaled` is the unjittered base used for the persisted `RecruitInterest.interest` field (Sprint 13 commit-resolution math depends on it); `computeBoardScore` adds the 25-pt star bonus + deterministic per-(team, recruit) jitter for ranking-only use. Sprint 37 deleted the legacy `computeBaseInterest` wrapper.
- **Test fixtures: avoid "specific entry + spread of defaults"** when building ID → value maps — later spreads clobber the specific entry. Build from a single source with conditionals.
- **Use `crypto.randomUUID()` for IDs and tokens**, never `Math.random()` (Sprint 1 determinism rule). Available globally in Node + Electron renderer.

### Save-file compatibility
- **`applyMigrations` is idempotent + tracked** via Prisma's `_prisma_migrations` table. Creates the tracking table on first run, skips already-applied migrations, records on apply. `openSaveSlot` is safe to call on saves created with older versions (CLAUDE.md §6).
- **Forward-compat audit before any schema change** — review §6 + verify `applyMigrations` covers the new migration. Schema changes during beta (no dynasty-test capacity) are too risky; defer aggregation/refactor migrations to v1.x sprints.
- **Save-file 10-season test bar is currently 60 MB**, not PRD's 25 MB. Documented inline in `save10Seasons.test.ts`. Match/PMS/Set row metadata dominates after 10 seasons. Closes via `TeamSeasonSummary` aggregation (deferred from Sprint 25 to v1.1+).

### Sim / calibration / determinism
- **Two calibration surfaces:** `npm run test:calibration` (rotation only), `npm run test:calibration:full` (Sprint 5 system + momentum). Side-out rate target = 65% ±3% (NCAA baseline).
- **Scripts in `scripts/` that import `@vcd/shared` read compiled `shared/dist`.** After changing `/shared/src/`, run `npm -w shared run build`. Stale dist produces `Cannot destructure property 'X' of 'import_shared.Y' as it is undefined`.
- **`exactOptionalPropertyTypes: true`** — `{x: undefined}` is NOT the same as `{}`. Forward optional fields with conditional spread: `...(src.x && {x: src.x})`.
- **JSON serialization:** `Number.NEGATIVE_INFINITY` / `POSITIVE_INFINITY` are NOT valid JSON — `JSON.stringify(Infinity) === 'null'`. Use finite sentinels (e.g. `-1` with `< 0` checks) for any state persisted to a JSON column.
- **Don't derive types from discriminated-union IPC responses via `infer`.** Conditional narrowing into a union branch often resolves to `never`. Re-import the canonical zod-inferred type instead.
- **`recordPerf`/`recordPerfAsync` is no-op without `VCD_PERF=1`.** Wrap any new hot path the PRD calls out — zero overhead in production runs.

### Project state quirks
- **Team roster is hand-authored at 360 rows** (vs PRD's "~340"). See `prisma/seedData/README.md`. Needs a data audit before v1.
- **`buildSeasonCalendar` supports any year** — anchors on the first Friday on/after Aug 28 of the requested year. Sprint 7's hardcoded 2026 throw is gone.
- **Crash recorder is OPT-OUT by default.** No file is written until `useSettingsStore.diagnosticsEnabled=true` (S24 rename of `crashReportingEnabled`), which IPCs `crash:setEnabled` to main.
- **Beta triage:** labels live in `docs/release/triage.md` + GitHub Issues label set. Bug template at `.github/ISSUE_TEMPLATE/bug.md` defaults new issues to `triage`. Hotfix workflow + survey delivery: see `docs/release/`.

---

*Read `PRD.md` for full detail. This file is a quick-reference for Claude Code sessions.*
