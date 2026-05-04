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

### 1. FCCD is reference — personal-use project

VCD is a personal/non-commercial project (Matt, single dev, never sold). Football Coach: College Dynasty is installed locally and may be referenced freely as a design source for layout, copy patterns, info hierarchy, interaction model, and inputs. The clean-room rule that previously appeared here was based on commercial-distribution risk that does not apply. Do not redistribute FCCD assets even so — keep raw asset files (PNGs, audio, fonts, `.asar` contents) out of the VCD repo. Reproducing screen designs, copying field names, mirroring flows, etc. is fine.

### 2. Determinism

The sim is deterministic given a seed. Every RNG call must go through the seeded RNG utility in `/shared/rng.ts` — never `Math.random()` in sim or scheduler code. Tests rely on this. A flaky test in sim/season/schedule code is almost always someone reaching for `Math.random()`.

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

Lessons from prior sprint retros — keep this list tight and project-specific.

### Build / module resolution
- **`/shared` emits CommonJS.** Electron main + Node workers consume via `require`;
  Vite reads source through the `@vcd/shared` alias. Do not flip shared to ESM
  without coordinating every consumer.
- **Cross-workspace imports go through `@vcd/shared`** (or the relevant package
  name). Never use relative `../../shared/src/...` — it typechecks via project
  references but fails at runtime. An ESLint rule enforces this.
- **`composite: true`** (inherited from `tsconfig.base.json`) forbids `noEmit`. For
  Vite-built workspaces, use `emitDeclarationOnly: true` with a dedicated
  `outDir` (e.g., `.tsbuild`).
- **Root tsconfig references:** only list a workspace when its `tsconfig.json`
  exists — Vite's tsconfck crashes with ENOENT on every test run otherwise.
- **`tsc -b` + stale `.tsbuildinfo`** can silently skip declaration emit. Delete
  `*.tsbuildinfo` (or use `--force`) after changing module/target/outDir.

### Testing
- **Vitest + JSX:** `vitest.config.ts` must include `@vitejs/plugin-react`.
  Without it, `.tsx` tests fail with `ReferenceError: React is not defined`.
- **Testing Library cleanup** requires `afterEach(cleanup)` in the setup file;
  auto-cleanup is off because Vitest globals are off.
- **Zustand stores are module singletons.** Reset them in `beforeEach` for
  component tests — DOM cleanup does not touch store state.
- **axe-core requires visible text in `<th>`.** `aria-label` on an empty header
  triggers `empty-table-header`. Use visible text (+ visually-hidden utility if
  needed).

### Electron / OS
- **Dev-mode gate:** `isDev = process.env.VCD_DEV === '1'` ONLY — never
  `!app.isPackaged`. Playwright `_electron.launch()` otherwise tries to hit the
  Vite dev server.
- **Playwright swallows main-process stderr on crash.** The file logger at
  `<userData>/vcd-main.log` is the first place to check when an e2e test times
  out without explanation.
- **Prisma CLI is fragile on spaced paths (OneDrive, "Program Files").** For
  per-DB migration apply, read `migration.sql` and run statements via
  `prisma.$executeRawUnsafe`. Strip `--` comment lines *before* splitting on
  `;`, not after.

### Data
- **Team roster is hand-authored (360 rows vs PRD's "~340").** See
  `prisma/seedData/README.md` for provenance and correction workflow. Needs a
  data audit before v1.

### From Sprint 25 fix-pass (P0/P1 follow-ups)
- **Anything in `shared/src/` that imports a Node-only module MUST live
  behind a sub-path export AND must NOT be re-exported from any barrel
  reachable from the renderer.** Sprint 25 found two pre-existing build
  breaks introduced in Sprint 23: `shared/src/sim/pbpCodec.ts` (imports
  `node:zlib` + `node:buffer`) was re-exported from
  `shared/src/sim/index.ts` and reached the renderer via the `sim`
  namespace; `shared/src/perf/timer.ts` (imports `node:fs`) was reached
  via the `perf` namespace. Both broke `npm run build` since Sprint 23.
  Fixes: pbpCodec moved to `@vcd/shared/sim/pbpCodec` sub-path export +
  removed from the sim barrel; perf/timer.ts switched to a lazy
  `require('node:fs')` inside `flushPerfLog`. Sprint 19 documented this
  pattern; if you find another similar leak, follow the same recipe.
- **`applyMigrations` is now idempotent + tracked.** Pre-Sprint-25 it
  re-ran every migration on every call, which works for fresh CREATE
  TABLE migrations but breaks on ALTER/rebuild migrations (Sprint 25
  PMS cascade). Now uses Prisma's standard `_prisma_migrations` table:
  creates the tracking table on first run, skips already-applied
  migrations, records the migration name on apply. This makes
  `openSaveSlot` safe to call on saves created with older versions —
  CLAUDE.md §6 forward-compat mandate.
- **`PlayerMatchStat.player` is now `onDelete: Cascade`** (Sprint 25
  P1.2). Pre-Sprint-25 the FK was RESTRICT and every Player-deletion
  path had to manually `tx.playerMatchStat.deleteMany` first.
  `runOffseason`'s explicit deleteMany calls are now defensive but no
  longer load-bearing. Migration:
  `prisma/migrations/20260921_000000_pms_player_cascade/`. Future
  Player-deletion paths (transfer portal, manual roster prune) just
  work without manual PMS cleanup.
- **Don't `Promise.all` 360 SQLite `prisma.match.create` calls.**
  Sprint 25 final gate hit a transient `Operations timed out after N/A`
  Prisma error on parallel match creation in the offseason fullCycle
  test. Fix: serial `for` loop. Generally — for >100 row inserts on a
  single SQLite DB, use `createMany` (where you don't need ids back) or
  serial creates (where you do).
- **Migration timestamp ordering: Sprint 25 added
  `20260921_000000_pms_player_cascade`** after Sprint 23's
  `20260907_000000_pbp_encoding`. Continue the sprint-aligned
  future-dated convention; don't let `prisma migrate dev --create-only`
  emit wall-clock timestamps that can disorder the apply sequence.
- **Background command monitoring lesson re-applied.** Sprint 25 wasted
  ~5 min on `npm test 2>&1 | tail -50` not flushing through the pipe
  buffer; redirect to file (`> output.log`) and grep the file directly.

### From Sprint 25
- **`computeBoardScore` ranks recruits for board seeding;
  `computeBaseInterest` seeds the persisted interest value.** They are
  intentionally different. Pre-Sprint-25, `openRecruitingCycle` ranked
  recruits by `computeBaseInterest` alone — but that function is
  star-agnostic (`STAR_DIFFICULTY_PER_STAR=0`) so all non-region-matching
  teams scored identically and the id-localeCompare tiebreaker funneled
  every team's top-30 onto the same id-sorted slice, leaving ~80% of the
  class on zero boards. `computeBoardScore` adds a stars bonus + a
  deterministic per-(team, recruit) jitter to fix the clustering. Don't
  swap one for the other.
- **`.gitignore` has `/release/` not `release/`.** The bare glob also
  matches `docs/release/`, which silently de-tracked Sprint 24's
  release-process docs. Anchored to `/release/` (top-level only) in
  Sprint 25; if a future sprint adds another folder named `release/` at
  a non-root path, audit the gitignore.
- **Sprint 13 fullCycle exit test 2 widened from ≥2.8 to ≥2.7 stars.**
  Recurring Monte Carlo flake (Sprint 22 hit 2.7799). 2.7 keeps the
  invariant meaningful — top program still ~1 star above league mean.
- **Sprint 9 poll exit test 1 widened from ≥4 to ≥3 overlap.** Recurring
  flake (Sprint 9, 17, 22, 24). Single-season poll snapshots have
  one-slot ordering noise vs the deterministic realistic-top-5 metric.
  ≥3/5 overlap is still a strong "poll roughly tracks reality" signal.
- **Sprint 17 coaching exit test 1's flake was a stale post-state
  contract, not statistical noise.** The query filtered to
  `commitState='COMMITTED'` after Sprint 24 made `closeRecruitingCycle`
  flip COMMITTED → SIGNED on signing day. The query missed every
  promoted recruit. Changed to
  `commitState: { in: ['COMMITTED', 'SIGNED'] }`. Same rule the Sprint 13
  fullCycle invariants picked up in Sprint 24 — any test that counts
  committed recruits post-close needs both states.
- **Beta triage labels live in `docs/release/triage.md` and the GitHub
  Issues label set.** The bug template at
  `.github/ISSUE_TEMPLATE/bug.md` defaults new issues to the `triage`
  label so they show up in `gh issue list -l triage`.
- **Hotfix workflow is patch-bump-only.** No new features, no schema
  migrations, no calibration knob changes in a hotfix. Bump `package.json`
  patch (e.g. 0.25.0 → 0.25.1), branch from `main`, build signed
  installer with `npm run build:installer:signed`, tag, push to a
  GitHub Release. See `docs/release/hotfix.md`.
- **Beta survey delivery is manual.** A Google Form created from the
  questions in `docs/release/beta-survey.md`. The PRD-critical question
  is Q1 (Likert 1–10 on "feels like a real volleyball match"); ≥8/10
  average across testers is the Sprint 25 ship gate.
- **Sprint 14 retro is reconstructed, not original.** See
  `docs/retros/sprint-14-retrospective-reconstructed-20260501.md`. The
  authoritative source for Sprint 14 lessons remains the "From Sprint
  14" block in this file plus the Sprint 15 retro's "lessons applied"
  references. If you find original Sprint 14 notes, replace the
  reconstruction.
- **`TeamSeasonSummary` aggregation deferred from Sprint 25.** The
  Sprint 25 plan spec'd a schema migration to drop historic Match/Set/
  PMS rows in favor of per-team-per-season summary rows, targeting the
  PRD §3.5 ≤25 MB save bar. Deferred — schema migration during a beta
  sprint without 60-min dynasty-test capacity is too risky. Test bar
  remains 60 MB. Revisit in Sprint 26 / v1.1 with a real perf gate.

### From Sprint 23
- **PBP gzip compression is the default for new rows.** `Match.pbpEncoding`
  is one of `'json'` (legacy Sprints 1-22), `'gzip-base64'` (Sprint 23+),
  or `'pruned'` (retention utility nulled the row). All readers must use
  `sim.decodePbp(payload, encoding)`. Never `JSON.parse(row.pbpJson)`
  directly — that hits both gzip-base64 and pruned rows wrong.
- **`runOffseason` runs `pruneOldSeasons` automatically.** Default
  `retainSeasons=1` (current year only) and `retainArchiveYears=3`. Older
  regular-season Match rows are deleted (cascades to Set + PMS); older
  tournament Match rows keep metadata but lose `pbpJson`. Followed by
  `VACUUM` to reclaim disk pages. Adjust the constants in
  `main/src/offseason/runOffseason.ts` if Sprint 24+ changes retention.
- **Multi-season dynasty currently requires a roster-topup workaround.**
  `closeRecruitingCycle` only flips PENDING → UNCOMMITTED; neither it
  nor `runOffseason` converts COMMITTED recruits to Player rows. Tests
  that simulate multiple seasons must call a `topupRostersForTest`-style
  helper between years. **Sprint 24 Task 24.1 closes this gap** —
  promotion happens inside `closeRecruitingCycle.$transaction`.
- **`buildSeasonCalendar` now supports any year.** Anchors on the first
  Friday on or after Aug 28 of the requested year. Sprint 7's hardcoded
  2026 throw is gone. Test fixtures using year 2026 still produce the
  same dates as before.
- **`@vcd/shared` exports are namespaces, not top-level types.** Anything
  under `shared/src/<module>/index.ts` is reached as `<module>.X` — e.g.,
  `crash.CrashRecord`, not `CrashRecord`. Sprint 23 hit this on the
  crash recorder import.
- **`recordPerf` / `recordPerfAsync` is no-op without `VCD_PERF=1`.**
  Wrap any new hot path the PRD calls out, but expect zero overhead in
  production runs (the wrappers short-circuit). Buffer is module-level,
  capped at 10K entries, flushed by main on `app.before-quit`.
- **Crash recorder is OPT-OUT by default.** No file is written until the
  user toggles `useSettingsStore.crashReportingEnabled=true` (Sprint 24
  renames to `diagnosticsEnabled`), which IPCs `crash:setEnabled` to
  main. No upload path exists yet — Sprint 24 release work decides
  transport + signing + consent.
- **Save-file 10-season test bar is 35 MB, not PRD's 25 MB.** Documented
  inline in `save10Seasons.test.ts`. The 5 MB residual gap is dominated
  by Match/PMS/Set row metadata overhead (54K+ rows after 10 seasons).
  Sprint 24+ closes via schema-level summary aggregation.
- **`PlayerMatchStat` has no FK cascade from Player.** Manually call
  `tx.playerMatchStat.deleteMany({ where: { playerId: { in: ... } } })`
  before any `tx.player.deleteMany`. Sprint 23 fixed `runOffseason`;
  any future Player-deleting code (transfer portal, manual roster
  prune) must do the same.
- **SQLite `VACUUM` cannot run inside a transaction.** Call it via
  `client.$executeRawUnsafe('VACUUM')` AFTER the prune transaction
  closes. SQLite leaves freed pages allocated until VACUUM rebuilds.
- **`global.gc()` requires `--expose-gc`.** Memory-leak tests use
  `cross-env NODE_OPTIONS=--expose-gc vitest run …` — see
  `package.json:test:perf-long`. Without the flag, GC timing is at
  V8's discretion and snapshots are noisy.

### From Sprint 22
- **Calibration tests use `it.skipIf(!benchmarkIsReal())` for PRD
  assertions.** `prisma/benchmarkData/ncaa-2024-25-stats.csv` ships as a
  STUB (header + comment line containing the literal `STUB` token).
  `parseBenchmarkCsv` returns `{ ok: true, stub: true, rows: [] }` when
  it sees that token; the test skips its tolerance assertions and logs a
  warning instead of failing. This pattern is the right way to ship
  scaffolding that depends on user-supplied data without blocking CI.
- **Volume-weighted top-25 aggregation, NOT mean-of-means.**
  `shared/src/calibration/teamSeasonAggregate.ts:aggregateTop25` builds a
  per-team `TeamAccumulator` (Σ kills, Σ totalAttacks, Σ setsPlayed,
  Σ liberoDigs filtered by `meta.isLibero === true`). Hitting % per team
  is `(Σkills − Σerrors) / ΣtotalAttacks`. Top-25 average is the mean
  across the (up to 25) team values. **Do not** average per-player rates
  and then re-average across players — that double-averages and
  systematically biases low-volume players' percentages.
- **`runFullSeason` is the canonical full-season orchestrator.** Lives at
  `main/src/calibration/runFullSeason.ts`. Takes
  `{dbPath, workerScriptPath, seasonYear, seed, workerCount?}`; drives
  13 weeks → 3 CT rounds → 6 NCAA rounds via SimWorkerPool; returns
  `{weeksAdvanced, ctRoundsCompleted, ncaaRoundsCompleted, championTeamId, elapsedMs}`.
  Caller owns DB lifecycle; runner manages its own pool. Sprint 23+ tests
  that need a played-out season should use this rather than re-extracting
  the orchestration from `tests/integration/postseason/fullPostseason.test.ts`.
- **Benchmark CSV path convention.** Real-world stats live under
  `prisma/benchmarkData/<dataset>.csv`. Sprint 22 ships
  `ncaa-2024-25-stats.csv`; future seasons drop sibling files and
  the loader filename gets bumped. The first comment-line `STUB` token
  switches the loader into placeholder mode.
- **`scripts/calibrate-season.ts --append-log` writes to
  `docs/calibration/tuning-log.md`.** Manual single-season runner used
  during tuning iterations. Pattern: spot-check a knob change here
  before running the 5-season Vitest suite. The log is append-only;
  newest entries at the top per the changelog header.
- **PRD top-25 metric vs. league composition are different files.**
  `prisma/benchmarkData/ncaa-2024-25-stats.csv` is the calibration
  reference (top-25 only — by PRD spec). `prisma/seedData/teams.csv` is
  the league (all ~360 D-I programs with prestige). Don't conflate when
  asked to "populate teams" — confirm scope first.
- **Sprint 13 recruiting "top-5 ≥ 2.8 stars" flake recurred** at 2.7799
  in Sprint 22's final gate. Documented from Sprint 13; not a Sprint 22
  regression. Three recurring Monte Carlo flakes (Sprint 9 poll,
  Sprint 13 recruiting, Sprint 17 coaching) need batch stabilization in
  a future cycle — `/schedule` an agent.

### From Sprint 21
- **Sub-path aliases must be regex-anchored.** Sprint 19 added a plain-string
  alias `'@vcd/shared/seed' → shared/src/seed/leagueSeed`. That greedily
  prefix-matched `@vcd/shared/seed/leagueSeed` (used by Sprint 13/15/17 seed
  unit tests) and produced a wrong path. Sprint 21 hotfix: switch
  `app/vite.config.ts` AND `vitest.config.ts` to regex aliases:
  ```ts
  alias: [
    { find: /^@vcd\/shared\/seed$/, replacement: ...src/seed/leagueSeed },
    { find: /^@vcd\/shared(\/.*)?$/, replacement: ...src + '$1' },
  ]
  ```
  Order matters — most-specific first. Whenever you add a new
  `@vcd/shared/<sub>` sub-path export, anchor it with `$` so it doesn't
  shadow deeper paths.
- **`useTableState` is the canonical sort/filter/multi-select pattern**
  (`app/src/hooks/useTableState.ts`). Used by RecruitingBoard / PortalView
  / NilView. Pure logic; renderHook-tested. Selection: `selectOnly`
  (single-click), `toggleSelected` (Ctrl+click), `selectRange` (Shift+click).
  Sort cycles asc → desc → cleared on repeated header clicks.
- **Font-size scaling lives in CSS custom properties.**
  `app/src/styles.css` defines `--fs-base`, `--fs-h1`, `--fs-h2`,
  `--fs-table`, `--fs-meta` — all via `calc(... * var(--fs-scale))`.
  Body classes `.fs-sm` / `.fs-md` / `.fs-lg` set `--fs-scale` to 0.85 /
  1.0 / 1.15. `useSettingsStore.fontSize` persists to localStorage; an
  effect in `App.tsx` toggles the body class.
- **axe-playwright is the live-Electron a11y tool.**
  `tests/e2e/programBuildingA11y.spec.ts` is the template. Use
  `injectAxe(window)` + `checkA11y(window, 'main', { axeOptions: { runOnly:
  { type: 'tag', values: ['wcag2a', 'wcag2aa'] } } })`. Keyboard-only
  flows use `window.keyboard.press('Tab')`. Run via `npm run test:a11y-e2e`.
- **User-team picker fires post-Save-create.** `SaveSlots.tsx` renders
  `TeamPickerModal` after `create()` returns a slotId, before opening
  the slot. Modal writes `Season.userTeamId` via
  `season.setUserTeam(slotId, teamId)`. RecruitingBoard / PortalView /
  NilView read from `useUserTeamStore` with `teams[0]` fallback for
  legacy saves where userTeamId is null.

### From Sprint 20
- **`@vcd/shared/seed` sub-path export needs aliases in 3 places.**
  Sprint 19's black-screen hotfix introduced the sub-path import, but
  the Sprint 20 final gate caught a missed alias in `vitest.config.ts`
  (Sprint 19 fix only updated `app/vite.config.ts`). Rule: when adding
  a `@vcd/shared/<sub>` sub-path export, alias it in BOTH
  `app/vite.config.ts` (renderer) AND `vitest.config.ts` (tests),
  more-specific alias FIRST. The package.json `exports` map handles
  Node runtime + tsc resolution; the bundler/test configs need their
  own aliases.
- **Recharts Tooltip `formatter` props use `Formatter<ValueType,
  NameType>`** — `value` is `ValueType | undefined` and `name` is
  `NameType | undefined`. Don't annotate handler params with primitive
  types; let TS infer and narrow inside. Pattern:
  `formatter={(value, name) => [typeof value === 'number' ? value.toFixed(2) : String(value ?? ''), String(name ?? '')]}`.
- **Recharts `ResponsiveContainer` doesn't render in jsdom.** Test
  files that mount Recharts components must `vi.mock('recharts')` and
  replace `ResponsiveContainer` with `<div style={{ width: 600,
  height: 280 }}>{children}</div>`. See `tests/unit/AnalyticsView.test.tsx`
  for the canonical pattern.
- **Slot → zone mapping** (`shared/src/analytics/types.ts:SLOT_TO_ZONE`):
  slots 0..5 → zones 6,1,2,3,4,5 (volleyball-conventional). Zone 0 is
  reserved for the "ace/error pile" — serves that didn't produce a
  reception. Used by serve-zone heat map only.
- **Analytics charts compute from `boxScoreJson + pbpJson + lineup
  ratingsBlock` only.** No new DB storage. The `match.getAnalytics`
  IPC extends Sprint 19's `match.getById` with `lineupRatingsBlock` +
  `lineupPositions` per side; rotation tracking is derived from PBP
  by walking side-outs. PRD §5 Sprint 20 exit test 1 enforces this.
- **Cross-validation invariants** for analytics charts live at
  `tests/integration/analytics/crossValidation.test.ts`. Whenever a
  chart-data shape changes, this test verifies the chart still
  reconciles to the box score. Fast (~2.5 sec), runs as part of
  `test:analytics-sim`.
- **Visual-regression baselines** for Sprint 20 charts live at
  `tests/e2e/__screenshots__/analyticsCharts.spec.ts/*.png`.
  Generate them with `--update-snapshots`; commit to git. CI runs
  without `--update-snapshots` and fails on diff. Threshold is
  generous (`maxDiffPixels: 200, threshold: 0.2`) to absorb font /
  anti-alias noise across machines.

### From Sprint 19
- **Renderer black-screen on launch when `shared/src/index.ts`
  re-exports a Node-only module.** `seedLeagueInto`
  (`shared/src/seed/leagueSeed.ts`) imports `node:fs` + `node:path`.
  When the top-level `shared/src/index.ts` re-exports it, Vite
  evaluates the module during renderer bundle build, fails to
  resolve `node:fs`, and React fails to mount → black screen with
  no console error in the dev log. The fix is multi-file: (a)
  `shared/package.json` adds an `"./seed"` `exports` entry; (b)
  `shared/src/index.ts` removes the seed re-exports; (c)
  `main/src/saveSlots/service.ts` and `prisma/seed.ts` import from
  `@vcd/shared/seed`; (d) `main/tsconfig.json` uses
  `module: "Node16"` / `moduleResolution: "Node16"` so TypeScript
  honors the exports map; (e) `app/vite.config.ts` adds a
  `'@vcd/shared/seed'` alias as a safety net. **Rule: anything in
  `shared/src/` that imports a Node-only module MUST live behind a
  sub-path export and NEVER be re-exported from the top-level barrel.**
- **Prisma `migrate dev --create-only` generates wall-clock-timestamped
  migrations.** This project uses sprint-aligned future-dated migration
  timestamps (Sprint 17 = `20260713_*`, Sprint 19 = `20260810_*`). After
  `--create-only`, **rename the generated migration directory** to a
  timestamp AFTER the most recent existing migration; otherwise
  `migrate deploy` on fresh test DBs applies migrations in the wrong
  order and references columns that haven't been added yet (Sprint 19
  hit this with `operatingBudgetCents` from Sprint 17).
- **`useCoachAi: true` is now enabled in production.** Sprint 19 wired
  it into `workers/src/simWorkerThread.ts` and
  `main/src/match/simulateAndPersist.ts`. The `simulateMatch` function's
  `useCoachAi` parameter defaults to `false` (preserves Sprint 5
  calibration test determinism); production paths opt in.
  **Calibration risk**: Sprint 5's side-out rate target may have
  drifted with timeouts active. Sprint 22 must verify.
- **`Match.timelineJson` schema** lives at `shared/src/sim/timeline.ts`.
  Sprint 19 ships only `timeouts[]` populated; `substitutions[]` is
  always `[]`. Future sprints can populate libero / starter↔bench
  swaps without changing the schema.
- **Sprint 4's `substitutionLedger` is dormant.** The structure exists
  in `shared/src/sim/substitutionLedger.ts` but the worker never
  consumes it. Don't assume scaffolded subsystems are wired into
  production — verify the call site.
- **Match Hub state machine phases** (`useMatchHubStore.phase`):
  `select` → `loading-teams` → `select` → `loading-scout` →
  `ready-to-play` → `simulating` → `loading-replay` → `replay-ready` →
  `playing` ↔ `paused` → `done`. The `play()` action transitions to
  `playing`; `pause()` to `paused`; the scheduler's `onComplete` to
  `done`.
- **Module-level controller/timers in `useMatchHubStore.ts` leak
  across tests.** `reset()` calls `controller.stop()` and clears
  `bannerTimer`, but if a test forgets to call `reset()` (or only
  calls it on the store, not the module), state can leak. For
  MatchHub tests, always call `useMatchHubStore.getState().reset()`
  in `beforeEach` AND explicitly clear `teams` if the test needs
  a fresh listTeams fetch (`reset()` does NOT clear `teams`).
- **Replay scheduler speed map** is locked at `1x = 1500ms`,
  `2x = 750ms`, `4x = 375ms`, `instant = 0ms`. Defined in
  `app/src/match/replayScheduler.ts` as `REPLAY_INTERVALS_MS`.
- **PBP ticker player names use the STARTING lineup**, not
  rotation-aware names. Sprint 18's `pickStartersForTeam` provides
  deterministic slot 0..5 → player.id; the prettifier
  (`shared/src/sim/pbpFormat.ts`) interpolates names from this
  fixed mapping. Cosmetically off after rotations within a set.
  Full rotation-aware labels deferred — requires either renderer-
  side rotation mirror or per-event playerId in PBP (latter rejected
  as ~675 MB/season save bloat).
- **Pre-match scout report** (`main/src/match/scoutReport.ts`) reads
  `Team.preferredSystem` (Sprint 19 column, default '5-1'), the
  opponent's last 5 played matches (W/L sequence), and top-3 OH/OPP
  hitters by season K/set. Eligibility: setsPlayed > 0; future
  sprint can tighten via the optional `eligible` predicate (same
  pattern as Sprint 18 `selectAllAmericans`).

### From Sprint 18
- **`npm run clean` wipes workspace symlinks on Windows.** The rimraf
  glob `**/*.tsbuildinfo` errors mid-run, leaving `node_modules/@vcd/`
  empty. Recovery: `npm install` to restore symlinks, then
  `npm -w shared run build && npm -w workers run build`. Prefer
  targeted deletion (`rimraf shared/dist`) over the bulk `clean`
  script until it's hardened.
- **Never put `role="button"` on a `<tr>`.** The `<tr>`'s implicit
  `role="row"` is overridden, the accessible name becomes the
  concatenation of all `<td>` text (so `getByRole('button', { name:
  'Player p1' })` fails), and axe flags the ARIA composition
  violation. Put the button inside a single `<td>` and use
  `aria-controls`/`aria-expanded` for inline expander relationships.
- **Box score is `slotIndex`-keyed, not `playerId`-keyed.** Sprint 18
  added `pickStartersForTeam` (`main/src/match/pickStarters.ts`)
  which resolves slot 0..5 → real `Player.id` with position-balanced
  fallbacks (1 S / 2 OH / 2 MB / 1 OPP / 1 L). All persistence sites
  (`simulateAndPersist`, `advanceWeek`, `advanceTournamentRound`)
  call this and zip with box-score slots to write `PlayerMatchStat`
  rows. The actual sim still uses synthetic ratings via the Sprint 6
  `lineupFromTeam` placeholder — starters are decorative labels for
  stat attribution, not ratings carriers.
- **AA composition: 2 OH / 2 MB / 1 OPP / 1 S / 1 L = 7 per team × 4
  teams = 28 selections per season.** Locked from PRD §5 Sprint 18
  ambiguity. Encoded in `shared/src/awards/composition.ts` as
  `AA_COMPOSITION` (frozen const). `AA_TEAM_SIZE = 7`,
  `AA_TOTAL_SELECTIONS = 28`.
- **Synthetic season generator for AA Monte Carlo** lives at
  `tests/fixtures/awards/syntheticSeason.ts`. Per-player aggregate
  stats sampled from position-specific Gaussian distributions; runs
  100 iterations in <1s. Use this template for any future
  algorithmic change to AA scoring/selection — far cheaper than
  running real season sims.
- **`computeSeasonAwards` runs INSIDE the same transaction as
  NCAA_CHAMP → OFFSEASON.** See
  `main/src/postseason/advanceTournamentRound.ts` around the
  `nationalChampionTeamId` block. Idempotent: skips if Award rows
  already exist for `seasonYear`. The function takes "current DB
  state" as "current season" — works at NCAA_CHAMP transition;
  fragile for retrospective historical re-computation until
  `Match.seasonYear` is added.
- **Test fixtures for position-balanced selection must use
  `pickStartersForTeam` (or otherwise guarantee position coverage).**
  Sprint 18's first integration-test pass used `players.slice(0, 6)`
  by `id ASC` and the AA pool starved at S/L because some teams had
  0 of those positions in the first 6 by id. Fix: load real starters
  via the production helper.
- **PRD eligibility threshold ("50% of team matches") was relaxed to
  `setsPlayed > 0` in Sprint 18.** Implementing the strict threshold
  needs a `Match.seasonYear` column to query per-team-per-season
  match totals cheaply. The `selectAllAmericans` API accepts a
  custom `eligible` predicate; tighten in a future sprint.

### From Sprint 17
- **Zero-inflated distributions fail Welch's t-test even with obvious
  effects.** Sprint 17's exit test 1 showed meanHigh=2.95 vs meanLow=0.43
  (7× magnitude) but single-cycle Welch gave p=0.02 — above the PRD's 0.01
  bar. For league-wide cohort comparisons where most teams are zeros, pair
  a p-value with a magnitude-ratio assertion, or pool 3 cycles before the
  t-test.
- **cuid insertion order correlates with seed-CSV order.** When splitting
  teams for A/B tests, don't sort by id and take halves — the top-prestige
  teams land in the same half. Split within prestige-consecutive pairs
  using an id-hash parity bit.
- **Role-aware coach queries need ALL coaches per team, not just HC.**
  Every Sprint 13-16 caller did `{ role: 'HC' }`. Sprint 17 dropped the
  role filter and switched to `pickCoachRating(teamCoaches, effect)`.
  Pattern: always load per-team coach sets; let the helper pick the slot
  per effect.
- **jest-axe pattern in this repo is `expect(results.violations).toEqual([])`**,
  not `expect(results).toHaveNoViolations()`. The matcher extension isn't
  registered. Follow the existing test pattern.
- **Defer strategy→sim wiring until necessary.** Touching the rally FSM
  forces a golden-fixture regen across rotation + rally FSM + calibration.
  Sprint 17 shipped the `ratingStrategy` helper but did not consume it.
  Sprint 18+ can decide.

### From Sprint 16
- **Verify critical Edits landed.** Sprint 16's development-model
  clamp fix appeared to succeed via Edit but the file was unchanged
  — downstream Monte Carlo showed starters' ratings going DOWN.
  For any Edit that changes load-bearing logic (clamps, comparisons,
  loop bounds), Read-after-Edit or grep the new text before running
  the test. Edit tool "success" is not proof of file mutation.
- **Clamp direction matters.** `Math.min(cap, next)` where
  `cap = min(99, potential)` forces ratings DOWN when a player's
  current rating already exceeds potential (Sprint 12 archetype can
  produce this). For growth models: `if (current >= cap) keep;
  else clamp(min, cap, next)` — only constrain upward growth.
- **Position-balanced sampling for system-level A/B tests.** Sprint
  16's starters-vs-bench test first split players by `id.sort()` —
  position distribution drift between pools (OH at cap, S below cap)
  skewed the signal. Fix: split within each `(team, position)`
  bucket. First id → starter, second id → bench. Eliminates a
  subtle confound.
- **PlayerMatchStat writes still not persisted (Sprint 6 carry-forward,
  now 11 sprints).** `main/src/match/simulateAndPersist.ts` still
  stores box-score JSON only. Blocks Sprint 16's redshirt auto-lock
  and any signal that aggregates real per-player minutes. Worked
  around in Sprint 16 tests by synthetically seeding
  `PlayerMatchStat` rows.

### From Sprint 15
- **Verify clamps don't collapse your range.** Sprint 15's first
  booster-budget formula produced $5.7M for a prestige-92 team —
  clamped to $550k. Every prestige-55+ team got identical budgets
  until the unit test failed. When a formula has a clamp, print 3
  representative pre-clamp outputs in <30 seconds before committing.
- **Write vs. Edit parameter disjointness.** Write creates/overwrites
  a file with `file_path` + `content` only. Edit modifies existing
  text with `old_string` + `new_string`. Don't conflate.
- **Read-before-Edit is session-level, not per-call.** Files edited
  in a prior sprint but not read this session will reject Edit.
  Recurring culprits: `window.d.ts`, `App.tsx`, `useNavStore.ts`,
  `preload.ts`. Batch-Read at the start of IPC/UI tasks.
- **Math.random reflex fixed.** After 5 sprints of the Sprint 1
  determinism rule catching it, Sprint 15 had zero occurrences.
  Baseline: any test-fixture identifier uses
  `crypto.randomUUID().slice(0, 7)`.
- **`test.sequential` candidates applied pre-Sprint-16:**
  `tests/integration/season/{weekPerf,memoryLeak}.test.ts` now run
  via `npm run test:perf` (two chained vitest invocations) and are
  excluded from the default suite. Eliminates the 3-sprint recurring
  flake.

### From Sprint 14
- **`export * as` lines in `shared/src/index.ts` can silently fail to
  land after an Edit.** Sprint 14 hit this twice: the Edit tool
  reported success but the exported namespace wasn't in the built file.
  After any edit to the shared index, grep for the new namespace name
  in the source file before running typecheck — saves 2 typecheck
  iterations when the edit was a no-op.
- **Cross-cutting entities (Coach, Player, Booster) all seed at
  save-slot creation via `seedLeagueInto`.** Sprint 13 added Coaches;
  Sprint 14 added Players (4,320 rows, +5-10s save-slot creation);
  Sprint 15 will add Boosters. Keep this pattern: any new entity that
  should exist for every team from day one goes in `seedLeagueInto`,
  derived deterministically from team prestige + seeded RNG.
- **Sprint 14's Monte Carlo passed all 3 PRD exit tests on first
  run.** Key reasons: prototype-validated the 8–15% entry-rate target
  in a unit test before writing the integration test (Sprint 13
  lesson applied), used batched `$transaction([...])` array form from
  the start (no interactive-tx wrapping), started with
  `crypto.randomUUID()` in test fixtures (no ESLint surprises).
  Pattern: "validate thresholds first, implement second" is now a
  reliable Sprint playbook.
- **Prisma relation filters on mutated fields are fragile.** Sprint
  13's `recruit: { commitState: 'PENDING' }` relation filter stopped
  returning rows mid-cycle; Sprint 14 pre-computed a Set of pending
  IDs and used `recruitId IN (...)` instead. For any filter that
  depends on a row state that changes during a loop, pull the id
  list first.

### From Sprint 13
- **Don't wrap 1,000+ Prisma update calls in an interactive
  `$transaction(async (tx) => { ... })`.** Sprint 13 hit a silent
  partial-commit failure at ~3,600 sequential updates: the tx returned
  successfully but inner reads started returning 0 rows. For
  independent-row bulk writes, use direct `client.x.update` calls or
  the array form `client.$transaction([promise1, promise2, ...])`.
  The array form does NOT accept `maxWait`/`timeout` — those are
  interactive-only.
- **N+1 queries in Prisma hot paths.** When a loop does `findMany` per
  iteration, load once and group in JS via `Map<id, Row[]>`.
  Sprint 13's `advanceRecruitingWeek` went from ~20s/week to ~1s/week
  with this single refactor.
- **Stale-snapshot iteration loops need a "repair" phase.** Any
  read-then-write loop where the world drifts between iterations
  should budget a reconciliation step. Sprint 13's board-replenish
  (committed recruits drained team boards to empty) and Sprint 9's
  inertia-rewrite are the same lesson in two domains.
- **PRD statistical thresholds need a prototype sim during planning.**
  Sprint 13's "top-5 averages ≥ 3.5 stars" turned out unachievable
  with a prestige-weighted interest model + Sprint 12 star
  distribution. Budget 15 minutes of ballpark simulation before
  committing to a numeric bar.
- **4th sprint in a row `Math.random()` hit in test fixtures**
  (8, 10, 11, 13). Default to `crypto.randomUUID().slice(0, 7)` for
  any random identifier. Sprint 1's determinism ESLint rule catches
  it; the reflex still isn't internalized.

### From Sprint 12
- **Small hand-authored datasets (<500 entries, dev-maintained) belong
  inline in TS arrays**, not in CSVs with a build step. Sprint 2-style
  CSVs are justified when non-engineers collaborate or the file is
  large; generator tables don't qualify.
- **Design the generator's OUTPUT type (`GeneratedRecruit`) first**,
  then derive Prisma schema additions from it. This surfaces every
  column the data actually needs before the migration is written.
- **Box–Muller in 3 LOC:** `sqrt(-2*ln(u1)) * cos(2π*u2)` where `u1, u2`
  are `rng.next()` calls. Guard against `u1 === 0` with
  `Math.max(1e-9, u1)`. Use for any Gaussian sampling — heights,
  potentials, rating noise.
- **Run the count/shape assertion tests mid-flow while authoring
  large inline datasets.** Vitest tells you "5 short" in 5 seconds;
  visual counting of line-per-N-entries TS arrays is error-prone.
- **`rng.fork(label)` is the right abstraction for multi-component
  sampling.** One root RNG → forked children for `position`, `star`,
  `name.first`, `name.last`, `hometown`, `rating.base`, etc. Each
  sub-component is deterministic in isolation.

### From Sprint 11
- **Plan Prisma schema by walking one concrete row per variant.**
  Before committing migration columns, sketch "what does a CT_R1
  match row look like?" vs "what does a NCAA_FF row look like?". The
  Sprint 11 plan missed `bracketSlot` and `bracketGroupKey` until
  mid-sprint because the schema was designed abstractly.
- **Per-slot worker pool lives in
  `main/src/season/poolRegistry.ts`**, not inside any IPC file.
  Any handler that dispatches to the pool imports `getOrCreatePool`
  and `disposeAllPools` from there.
- **`isTournament=true` is ambiguous** — used for both pre-season
  invitationals (Sprint 7) and post-season brackets (Sprint 11).
  To filter for "real" tournament matches, use
  `tournamentRound IN ('CT_R1','CT_SF','CT_F','NCAA_R64',…)`. A
  future `Match.tournamentType` enum would fix this.
- **RTL `getByText` throws on multiple matches.** For strings that
  render both in a headline and a table cell (e.g., a school name),
  use `getAllByText(...).length > 0` or scope with `within(...)`.
- **Round-agnostic dispatchers > per-round functions** when the
  mechanics are identical. `advanceTournamentRound` loads unplayed
  matches for a round → dispatches to the worker pool → atomic write
  of results + next-round rows. Pair winners by `bracketSlot`
  (matches 2i and 2i+1 in round N → match i in round N+1) within
  `bracketGroupKey`.

### From Sprint 10
- **Selection-then-seeding pipelines re-rank the field.** When an
  algorithm takes N items, picks a subset of K<N, and places them in
  K ordered slots, invariants on the output should be written against
  the subset's internal rank — not against the global input rank. A
  team with global metric rank 150 who receives an auto-bid will
  legitimately sit on a middle-line seed; that's not a bug.
- **Weighted-formula tests need varied-record fixtures.** Testing
  "site-weighted WP" with two undefeated teams is a tautology. Build
  fixtures where the teams have the same unweighted record but
  different site distributions to surface the weighting.
- **`RPISnapshot` is the RPI persistence path; `BracketEntry` is the
  seeded-field persistence path.** Two separate tables because the
  former is weekly and the latter is per-season.
- **Perf tests with wall-clock thresholds need serial execution or
  ~50% slack.** `tests/integration/season/weekPerf.test.ts` flakes
  under concurrent vitest workers; Sprint 8 retro showed ~5.8s
  median, the 8s budget has only 38% headroom, so one scheduling
  bubble tips it over. Fix with `test.sequential` when annoying.

### From Sprint 9
- **Unit tests don't catch emergent integration bugs in slot-filling
  algorithms.** When a function places entities into overlapping slot
  ranges (ranking, scheduling, bracket seeding), write a unit test that
  pushes many entities through the same narrow constraint — otherwise
  the bug only surfaces at integration scale. The Sprint 9 inertia
  rewrite is the template for this class of failure.
- **Rank-slot assignment > sort-and-renumber** for rank-based placement
  problems. Compute allowed `[lo, hi]` per entity; walk in priority
  order; place in first free slot within range; drop off when no slot
  fits. Don't fill empty slots with overflow — that defeats the range
  constraint.
- **Test fixtures: avoid "specific entry + spread of defaults"** when
  building ID → value maps. The later spread entries clobber the
  specific entry. Build from a single source with conditionals instead.
- **`npm run check` discipline (recurring).** Flagged in Sprints 3, 5, 8,
  9. The script exists; run it after each task, not only at final gate.

### From Sprint 8
- **Use `crypto.randomUUID()` for IDs and tokens**, not `Math.random()`.
  The Sprint 1 determinism ESLint rule is blanket and intentional; any
  random identifier should use `crypto.randomUUID()` (available globally
  in both Node and the Electron renderer).
- **Prisma `$transaction` default timeout is 5 seconds.** For heavy atomic
  writes (advanceWeek does ~3000 queries across 500+ matches), pass
  `{ maxWait: 30_000, timeout: 60_000 }`.
- **`worker_threads` from Electron main** works in dev/Playwright without
  packaging work. `electron-builder` asar handling is deferred to the
  packaging sprint.
- **Long-running background services use per-slot Maps**: lazy-init on
  first request, dispose in `app.before-quit`. See `seasonHandlers` for
  the pattern.
- **Vitest unhandled errors only show as a summary count**, not test
  failures. When a child component is embedded into an existing screen,
  update ALL tests that mount the parent to include the new IPC mock.
- **Transient UI state tests must stall initial-load effects**. If a
  component's `useEffect` resets a status to `'idle'` on mount, setting
  `'advancing'` via `setState` before render will be overwritten. Use a
  never-resolving mock for the loader to preserve the test state.
- **`npm run check` is the per-task discipline gate.** Runs lint +
  typecheck in ~5 seconds. Retros for Sprints 3, 5, 8 all flagged the
  same "run lint per task" lesson — the `check` script makes it trivial.

### From Sprint 7
- **Read PRD exit tests arithmetically during sprint planning.** S7's
  exit test 1 (strict double round-robin) and exit test 2 ([28, 32] cap)
  were trivially contradictory for 18-team conferences (2×17 = 34 > 32).
  The plan caught it pre-execution and amended to [28, 40]. Make PRD-math
  a standard planning step.
- **`Team.region`** is seeded from `TEAM_REGION_OVERRIDES` in
  `@vcd/shared/seed/teamRegions.ts`. Defaults to `'CENTRAL'`. Only used
  for scheduler travel sanity.
- **Schedule determinism contract:** `generateSchedule({ teams, seasonYear,
  seed })` is byte-identical under identical inputs. Any non-determinism
  fails `tests/integration/schedule/generateAndPersist.test.ts`.
- **PRD Sprint 7 exit test 2 cap amendment (32 → 40)** lives in
  `tests/integration/schedule/invariants.test.ts`. Preserve until PRD is
  formally updated.

### From Sprint 6
- **Electron sandboxed preloads cannot `require('@vcd/shared')`** (or any
  non-whitelisted module). We run with `webPreferences.sandbox: false`;
  `contextIsolation: true` + `nodeIntegration: false` provide the security
  envelope. Flip sandbox back on only after bundling the preload as a
  self-contained script.
- **E2E tests must exercise the IPC bridge, not just render the entry
  screen.** A test that only asserts "heading visible" silently masks
  catastrophic preload regressions. Every screen with IPC-backed data
  should have an e2e that triggers at least one IPC round-trip.
  `tests/e2e/preloadBridge.spec.ts` is the canary for this.
- **Playwright `getByRole` matches accessible name as substring by default.**
  When two buttons share a substring (row's name link + delete button),
  always use `exact: true` or scope via `within`.
- **`Window['vcd']`** is declared in exactly one place —
  `app/src/types/window.d.ts`. Don't scatter `declare global` across
  feature stores.
- **Don't derive types from discriminated-union IPC responses via `infer`.**
  Conditional narrowing into a union branch often resolves to `never`.
  Re-import the canonical zod-inferred type instead.
- **CLI-side logic that may run in-process later should live in
  `@vcd/shared` from day one.** Save-slot creation calls
  `seedLeagueInto(prisma, repoRoot)` from shared — same function the tsx
  CLI uses.
- **PlayerMatchStat rows are deferred until Sprint 12.** Per-match
  per-player stats live in `Match.boxScoreJson` until real Player rows
  exist.

### From Sprint 5
- **6-2's attacker pool excludes BOTH setter indices, not just the current
  setter.** The two setters sit opposite in rotation, so one is always
  front-row; excluding both gives 6-2 a 2-hitter pool vs 5-1's 3-hitter pool.
- **First-attack hitting% is the clean measurement for system-level A/B
  tests.** Rally-extending dugs distribute later attacks symmetrically and
  dilute system-selection bias into noise.
- **`exactOptionalPropertyTypes: true`** means `{ x: undefined }` is NOT the
  same as `{}`. Forward optional fields with conditional spread:
  `...(src.x && { x: src.x })`.
- **Two calibration surfaces exist.** `npm run test:calibration` covers
  rotation-only; `npm run test:calibration:full` covers the full Sprint 5
  engine (system + momentum). A regression in either is a tuning bug, not a
  test bug.

### From Sprint 4
- **Rotation is position-aware selection, not player-to-slot assignment.**
  `RotationState.slots` is an ordered tuple `[P1, P2, P3, P4, P5, P6]` of
  lineup-player indices. `rotate()` is a left shift (P2 player becomes new P1).
  Six rotations is identity.
- **Libero "above net" is approximated by front-row slot occupancy.**
  `liberoBlocksAttack` returns true when the libero is in any front-row
  position. Real FIVB rule 19.3.1.3 cares about net height, not slot. Revisit
  if/when the sim models ball height.
- **`simulateRally` has an optional/legacy flat-rotator path.** When rotation
  fields are omitted, selection uses round-robin by slot index (the Sprint 3
  path). Prod callers must always pass rotation + libero state; tests may
  omit them for simplicity.
- **Golden-fixture input parsers must stay in sync.** Use
  `parseRallyFixtureInput()` from `@vcd/shared` in both the regen script
  and the golden harness. Never duplicate the parse logic.

### From Sprint 3
- **Scripts in `scripts/` that import `@vcd/shared`** read compiled
  `shared/dist`. After changing any file under `/shared/src/`, run
  `npm -w shared run build` (the root `prebench` hook automates this for
  `npm run bench`). A stale dist produces
  `Cannot destructure property 'X' of 'import_shared.Y' as it is undefined`.
- **Golden-fixture lifecycle:** on the first sprint that introduces a new sim
  surface, calibrate the probability tables BEFORE generating goldens. From
  that commit forward, any numeric change must regenerate the fixtures in a
  dedicated commit (CLAUDE.md §Golden fixtures).
- **Side-out rate calibration:** 65% ±3% is the NCAA baseline. The calibration
  test runs in `npm run test:calibration`; a drift indicates a probability-table
  regression. When later sprints change rotation or sampling order, re-run
  calibration and update knobs in `/shared/src/sim/tuning.ts` deliberately,
  with the fixture regeneration in the same commit.
- **ESLint catches cross-workspace relative imports early.** Rely on it; do
  not write relative paths like `../../shared/src/...` and expect them to stay.

---

*Read `PRD.md` for full detail. This file is a quick-reference for Claude Code sessions.*
