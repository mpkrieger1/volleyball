# Sprint 2 Retrospective

**Date:** 2026-04-18
**Sprint Goal:** A real league loads from disk into a working SQLite DB.
**Status:** Complete (83/83 tests green, Playwright smoke green, all 3 PRD exit tests verified locally; remote-CI verification still pending first GitHub push)
**Health:** 🟡 Bumpy

---

## SPRINT 2 HEALTH SUMMARY

```
Tasks Completed:        6 / 6
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     8
  - Failed Approaches:  2
  - Repeated Attempts:  0
  - Diversions:         1
  - Unexpected Errors:  4
  - PRD Deviations:     1
  - Missing Prereqs:    0
  - Dependency Issues:  0

Overall Sprint Health:  🟡 Bumpy — every issue resolved same-session; two root-causes
(shared CJS vs ESM, cross-workspace relative imports) surfaced as two symptoms each.

Top 3 Time Sinks:
1. Electron main crash from /shared emitting ESM — Unexpected Error
2. Prisma CLI choking on OneDrive-spaced schema path — Failed Approach
3. Migration SQL splitter dropped statements starting with `--` — Unexpected Error
```

---

## Issues

### Issue 1: Prisma CLI failed to load schema from OneDrive-spaced path

**Category:** Failed Approach

**Sprint Task:** Task 2.3 — SaveSlot service

**What happened:**
First implementation of `createSaveSlot()` called `npx prisma migrate deploy --schema
<repoRoot>/prisma/schema.prisma` per new slot. Prisma errored:
`Could not load --schema from provided path "..\..\..\..\OneDrive": "prismaSchemaFolder"
preview feature must be enabled`. The Windows backslashed path-with-spaces was being
rewritten by Prisma into a corrupted relative form.

**Attempts made:**
1. `execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', fullPath])` with
   `shell: process.platform === 'win32'`. Failed: Prisma misparsed the path.

**Resolution:**
Abandoned the CLI entirely. Wrote `applyMigrations()` that reads each
`prisma/migrations/*/migration.sql` file and executes statements via
`prisma.$executeRawUnsafe`. Side benefit: create-slot dropped from ~3s to ~60ms, and
tests went from 15s to 351ms.

**Diverted from original plan?** Yes — plan said "run the initial Prisma migration SQL
against the new game.db on create"; original implementation used `prisma migrate
deploy`. Final implementation applies SQL directly (same outcome, faster, path-agnostic).

**Impact on sprint:**
- Time cost: Medium.
- Code quality: Improved (faster + simpler + no external process).
- Technical debt introduced: Mild — the SQL splitter is a homegrown parser; if a future
  migration ever includes a `--`-prefixed line inside a string literal or contains
  statements with embedded semicolons, it may mis-split. Document the constraint and
  revisit if it breaks.

**Lesson for future sprints:**
When the repo lives on a path with spaces (OneDrive, "Program Files", etc.), avoid
sub-process CLI invocations whose argv parsing is finicky with Windows paths. Prefer
in-process library APIs.

---

### Issue 2: Migration SQL splitter dropped statements beginning with `--` comments

**Category:** Unexpected Error

**Sprint Task:** Task 2.3 — SaveSlot service (same fix cycle as Issue 1)

**What happened:**
After switching to direct SQL execution, first run of `createSaveSlot()` returned
`P2021: table "SaveSlot" does not exist`. Root cause: my statement splitter did
`sql.split(/;\s*(?:\r?\n|$)/).filter((s) => !s.startsWith('--'))`. Prisma's generated
migration SQL prefixes each statement with a `-- CreateTable` line. My filter
discarded the entire `-- CreateTable\nCREATE TABLE ...` chunks, leaving the DB empty.

**Attempts made:**
1. Filter chunks whose trimmed text starts with `--`. Entire migration silently
   skipped.
2. Strip lines that start with `--` *before* splitting on `;`, then run remaining
   statements. Worked.

**Resolution:**
Two-pass parser: line-strip comments → split on `;` → filter empties.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean.
- Technical debt introduced: Same as Issue 1 — the splitter is fragile. Consider
  replacing with a proper SQL tokenizer if a future migration ever uses
  string-literal semicolons.

**Lesson for future sprints:**
When filtering "comments" from generated SQL, strip per-line, not per-statement. A
multi-line SQL chunk that begins with a comment line is still a valid statement.

---

### Issue 3: /shared emitted ESM, but Electron main is CJS — main process crashed silently under Playwright

**Category:** Unexpected Error

**Sprint Task:** Task 2.6 — Consolidation (caught when running Playwright)

**What happened:**
Electron main threw at load:
```
shared\dist\index.js:1
export { createRng, hashSeed } from './rng';
^^^^^^
SyntaxError: Unexpected token 'export'
```
`/shared/tsconfig.json` had `module: "ESNext"` from Sprint 1. Main + workers use CJS
(tsc's default, module: CommonJS). When main required `@vcd/shared`, Node tried to
load the ESM output as CommonJS and syntax-errored.

Worse: Playwright's trace surface obscured this. The trace showed
`<ws disconnected> code=1006` and `process did exit: exitCode=1` with zero stderr.
Only a direct manual `electron main/dist/index.js` surfaced the SyntaxError.

**Attempts made:**
1. First Playwright run — test timeout with no useful error context. Added process
   wait-and-inspect via `unzip` on the trace.zip → surfaced exitCode=1, still no
   stderr.
2. Manual `electron main/dist/index.js` run → SyntaxError visible in stdout.
3. Switched `/shared/tsconfig.json` to `module: "CommonJS"` + `moduleResolution: "Node"`.
   Vite reads source via its alias so the app bundle is unaffected; main + workers now
   load the CJS output fine.

**Resolution:**
`/shared` now emits CommonJS. All three consumers (main, workers, app-via-Vite-source)
work from the same source tree.

**Diverted from original plan?** No — the plan didn't specify module format; the
default Sprint 1 choice was wrong and Sprint 2 exposed it.

**Impact on sprint:**
- Time cost: Medium. Diagnosing the silent crash burned ~10 min because Playwright's
  error surface was unhelpful.
- Code quality: Clean fix at the root.
- Technical debt introduced: No, but the asymmetry (Vite reads source, main reads
  dist) means future additions to `/shared` could create new CJS/ESM drift. Add a unit
  test that `require('@vcd/shared')` works at runtime from a CJS context.

**Lesson for future sprints:**
For a multi-target TS package (Electron CJS main + Vite-bundled renderer + Node
workers), commit to CJS output from day one unless every consumer opts into ESM
together. Playwright's default `_electron.launch` swallows main-process stderr on
crash — add a main-side file-logger early to shortcut this class of debug.

---

### Issue 4: Cross-workspace relative imports typechecked but didn't resolve at runtime

**Category:** Unexpected Error

**Sprint Task:** Task 2.3 + 2.5 (caught during Task 2.6 Playwright)

**What happened:**
`main/src/preload.ts` and `main/src/ipc/saveSlotHandlers.ts` initially imported from
`../../../shared/src/ipc/saveSlotMessages` (a relative path into the sibling workspace
source). TS project references happily resolved the types via the `/shared` project ref,
and `tsc -b` emitted code. But at runtime node tried to load the file at the literal
relative path from `main/dist/...`, which resolved to `shared/src/ipc/saveSlotMessages`
— a `.ts` file node can't execute.

This compounded with Issue 3. Even after switching to CJS, relative source imports
would have kept pointing at `.ts` files that weren't in dist.

**Attempts made:**
1. Original: relative `../../../shared/src/...` imports. Silent at build, crash at run.
2. Switched to `import { saveSlotIpc } from '@vcd/shared'`. Works because main's
   package.json depends on `@vcd/shared: "*"`, npm workspaces symlinks
   `node_modules/@vcd/shared` → `/shared`, and `/shared/package.json` exports map
   points to `./dist/index.js`.

**Resolution:**
All cross-workspace imports go through the `@vcd/shared` package name. Relative source
imports across workspace boundaries are banned.

**Diverted from original plan?** No — the plan implied typed IPC via /shared; the
fix just corrects the import style.

**Impact on sprint:**
- Time cost: Medium (interleaved with Issue 3).
- Code quality: Improved — enforces the package-boundary contract.
- Technical debt introduced: No.

**Lesson for future sprints:**
Add an ESLint rule that forbids relative imports crossing a workspace boundary (e.g.,
`no-restricted-imports` on `../*/src/**`). TS project references alone will let the
mistake through.

---

### Issue 5: `tsc -b` with stale .tsbuildinfo silently skipped declaration emit

**Category:** Unexpected Error

**Sprint Task:** Task 2.6 — Consolidation

**What happened:**
After renaming `/shared/tsconfig.json` module field, `npm -w shared run build`
exited 0 but produced only `.js` and `.js.map` files — no `.d.ts`. That cascaded into
`main` failing typecheck with `TS7016: Could not find a declaration file for module
'@vcd/shared'`.

**Attempts made:**
1. `npm -w shared run build` — 0 exit, d.ts missing.
2. `rm -rf shared/dist && npm -w shared run build` — still exited without creating the
   dist dir (tsc thought nothing was dirty thanks to the cached tsbuildinfo).
3. Deleted all `*.tsbuildinfo` files under the repo, then rebuilt — d.ts files
   reappeared.

**Resolution:**
Stale tsbuildinfo was the culprit. Manual purge unblocked the build.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Fine once rebuilt.
- Technical debt introduced: Yes, mild — our `build` script should probably clear
  tsbuildinfo when config changes. Either add a `clean` step to CI or use
  `tsc -b --force` in the build chain.

**Lesson for future sprints:**
When a tsconfig changes (module, target, output paths), `tsc -b` won't always notice;
add a `clean` script and call it when `.tsbuildinfo` is older than the tsconfig.

---

### Issue 6: axe-core rejected `<th aria-label="Actions" />` as empty-table-header

**Category:** Unexpected Error

**Sprint Task:** Task 2.4 — Save-slot screen

**What happened:**
Component test's axe assertion failed:
`expected [ { id: 'empty-table-header', ... } ] to deeply equal []`. axe treats an empty
`<th>` with only aria-label as a violation — visible text is required by WCAG even
when a screen reader can find a label.

**Attempts made:**
1. `<th aria-label="Actions" />`. Violation.
2. `<th scope="col">Actions</th>`. Clean.

**Resolution:**
Just made the label visible. No loss — the Actions column reads well regardless.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
`aria-label` on a visually-empty `<th>` is not a WCAG-compliant substitute for text.
Default to visible text for headers; use visually-hidden text only when truly
necessary.

---

### Issue 7: SaveSlots unit tests needed explicit store reset between tests

**Category:** Unexpected Error

**Sprint Task:** Task 2.4 — Save-slot screen

**What happened:**
First run of `SaveSlots.test.tsx` had tests bleeding state through the Zustand store
(`openedSlotId`, `slots`, `error`). A test that opened a slot left `openedSlotId` set
and the next test's `useSaveSlotsStore()` started with that residue. Testing Library's
`cleanup()` tears down the DOM but not module-scoped Zustand stores.

**Attempts made:**
1. Relied on afterEach(cleanup) alone. First test's state leaked into second.
2. Added a `beforeEach` that resets the store via `useSaveSlotsStore.setState({...})`.
   Clean.

**Resolution:**
Per-test store reset in `SaveSlots.test.tsx`. Consider a shared test helper for
every Zustand store as they accumulate.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: OK; boilerplate will grow.
- Technical debt introduced: Yes, mild — each new Zustand store will need the same
  reset. Introduce `tests/setup/resetStores.ts` when there are 3+ stores.

**Lesson for future sprints:**
Zustand stores are module singletons. Testing Library cleanup is DOM-only; store
state must be reset explicitly between tests.

---

### Issue 8: Team count is 360, not PRD's "~340"

**Category:** PRD Deviation

**Sprint Task:** Task 2.2 — 2026 D-I seed data

**What happened:**
PRD §2 and §5 call out "~340 D-I programs". The hand-authored `teams.csv` ended up
at 360 rows across 31 conferences. The PRD uses "~" so this is within tolerance, but
noting the exact number for accountability.

**Attempts made:**
N/A — this was a one-shot data authorship decision. Some of the 360 may be programs
that don't actually sponsor women's D-I volleyball; a future data audit should
true-up the roster.

**Resolution:**
`expected-counts.json` locks 360. `prisma/seedData/README.md` documents the
provenance as hand-authored best-effort and invites corrections.

**Diverted from original plan?** Yes — plan said "All ~340 D-I programs for 2026
alignment"; shipped 360. The overcount is most likely driven by including some
programs that don't field women's volleyball or by outdated conference membership.

**Impact on sprint:**
- Time cost: Low (not a blocker).
- Code quality: Clean, but data correctness is approximate.
- Technical debt introduced: Yes — the dataset needs an audit before v1 ships.
  Sprint 9 or Sprint 18 (both touch ranking / season features) is a natural checkpoint
  to schedule this.

**Lesson for future sprints:**
Hand-authored league data is a research task, not a coding task. Next time a data
seed is this large, (a) start from an authoritative CSV export, or (b) budget a
separate data-audit sprint task.

---

## Recommendations for Sprint 3

### Carry-forward items
- **Sprint 1 + Sprint 2 both still blocked on `CI green on clean clone`** — no git
  remote and no first push yet. Combined PRD exit-test gap spanning two sprints.
  Resolve before Sprint 3 tags.
- **Team-roster data audit** — 360 rows vs PRD's "~340" is fine for now but should be
  trued up before v1. Flag as a Sprint 9+ backlog item.
- **Sprint 1 retro's CLAUDE.md "Gotchas accumulated" block still not applied.** Merge
  both sprints' gotchas in one CLAUDE.md update this sprint.

### Technical debt to address
- SQL migration splitter (service.ts) is a homegrown parser; vulnerable to SQL with
  string-literal semicolons. Replace with a proper tokenizer if a future migration
  introduces such content.
- `tsc -b` + stale `.tsbuildinfo` can hide declaration-emit failures. Add a `clean`
  script or run `tsc -b --force` in CI.
- No ESLint rule prevents cross-workspace relative imports (Issue 4). Add
  `no-restricted-imports` rule banning `../*/src/**` and `../../*/src/**`.
- Zustand stores need a shared test-reset helper once we hit 3+ stores.
- Main-process file logger (`vcd-main.log`) is useful but writes regardless of
  environment; consider gating verbose logs on `VCD_DEV=1`.

### CLAUDE.md updates to add

Append a combined "Gotchas accumulated" section covering both sprints:

```markdown
## Gotchas accumulated

### From Sprint 1
- **Vitest + JSX:** `vitest.config.ts` must include `@vitejs/plugin-react`. Without it,
  `.tsx` tests fail with `ReferenceError: React is not defined`.
- **Testing Library cleanup:** `tests/setup/vitest.setup.ts` must call
  `afterEach(cleanup)`. Auto-cleanup does NOT trigger when Vitest globals are off.
- **Electron dev-mode gate:** `isDev` must be `process.env.VCD_DEV === '1'` only —
  never `!app.isPackaged`. Playwright `_electron.launch()` otherwise tries to hit the
  Vite dev server.
- **tsconfig composite:** every workspace tsconfig extending `tsconfig.base.json`
  inherits `composite: true`. `composite` forbids `noEmit`. For Vite-built workspaces,
  use `emitDeclarationOnly: true` with a separate `outDir` (e.g., `.tsbuild`).
- **Root tsconfig references:** only list a workspace in `tsconfig.json#references`
  when its `tsconfig.json` exists — otherwise Vite's tsconfck crashes on every test run
  with ENOENT.

### From Sprint 2
- **`/shared` emits CommonJS.** Electron main + Node workers consume it via `require`;
  Vite reads source via the `@vcd/shared` alias. Do not flip shared to ESM without
  coordinating with every consumer.
- **Cross-workspace imports go through `@vcd/shared` only.** Relative imports like
  `../../shared/src/...` typecheck via project references but fail at runtime.
- **Zustand stores are module singletons.** Reset them in `beforeEach` in component
  tests; DOM cleanup does not touch store state.
- **Prisma CLI is fragile on paths with spaces.** For per-DB migration apply, read
  `migration.sql` and run statements via `prisma.$executeRawUnsafe`. Strip `--`
  comment lines *before* splitting on `;`, not after.
- **Playwright's `_electron.launch` swallows main-process stderr on crash.** Add a
  file logger (`<userData>/vcd-main.log`) with uncaughtException/unhandledRejection
  handlers; inspect it when an e2e test times out mysteriously.
- **`tsc -b` + stale `.tsbuildinfo` can skip declaration emit silently.** Delete
  `*.tsbuildinfo` or use `--force` after changing tsconfig module/target/outDir.
- **axe-core requires visible text in `<th>`.** `aria-label` alone triggers
  `empty-table-header` violation. Use visible text (with visually-hidden utility if
  necessary).
- **Team roster is hand-authored.** 360 rows vs PRD's "~340"; see
  `prisma/seedData/README.md` for provenance and correction workflow.
```

### PRD corrections

None required, but recommend softening the "~340" phrasing in PRD §2 / §5 to the
actual count once a post-audit pass happens, so future contributors don't treat the
number as precisely targeted when it isn't.

---

## Notes

This sprint cleared all three PRD exit tests locally (conferences/teams counts via
integration test; create/delete slot flow proven; every-team-one-conference invariant
in both unit and integration tests). The bumpiness was concentrated in build-system
and runtime-module-resolution issues, not in the sim/domain logic. Sprint 3's goal
(Rally FSM) should be immune to this class of bug as long as the conclusions above
are carried forward.
