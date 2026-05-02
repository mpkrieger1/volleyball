# Sprint 1 Retrospective

**Date:** 2026-04-18
**Sprint Goal:** Empty-but-runnable Electron shell committed to CI.
**Status:** Complete (code-complete; CI green-on-clean-clone pending first remote push)
**Health:** 🟡 Bumpy

---

## SPRINT 1 HEALTH SUMMARY

```
Tasks Completed:        6 / 6
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     6
  - Failed Approaches:  1
  - Repeated Attempts:  0
  - Diversions:         1
  - Unexpected Errors:  3
  - PRD Deviations:     0
  - Missing Prereqs:    1
  - Dependency Issues:  0

Overall Sprint Health:  🟡 Bumpy — all issues resolved same-session, no unresolved debt.

Top 3 Time Sinks:
1. Vitest tsconfck failure on missing workers/tsconfig.json — Missing Prereq
2. JSX "React is not defined" during component tests — Unexpected Error
3. Playwright e2e saw empty title because unpacked Electron took dev-mode branch — Unexpected Error
```

---

## Issues

### Issue 1: Root tsconfig references broke vitest before other workspaces existed

**Category:** Missing Prerequisite

**Sprint Task:** Task 1.3 — Renderer /app (surfaced when tests first ran)

**What happened:**
On the first `npm test` run, Vitest failed to collect every test file. Vite's `tsconfck`
parser walks the root `tsconfig.json`'s project references and errored:
`ENOENT: no such file or directory, open '.../workers/tsconfig.json'`. Task 1.1 had
already set the root tsconfig to reference all four workspaces, but Task 1.4 (workers)
hadn't landed yet.

**Attempts made:**
1. Ran `npm test` after Task 1.3 files were in place — all five test files failed
   collection with the tsconfck ENOENT.

**Resolution:**
Pulled Task 1.4 forward in the execution order — created `workers/package.json`,
`workers/tsconfig.json`, and the noop worker. Tests then collected and passed.

**Diverted from original plan?** Yes — the original execution order in the plan put
Task 1.4 (workers) third, between 1.1 and 1.2. During execution I inadvertently did
1.1 → 1.2 → 1.3 first, which tripped this.

**Impact on sprint:**
- Time cost: Low (one file triad, a few minutes).
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
When a root config (tsconfig, eslint, vitest) names paths from multiple workspaces,
either land all the referenced stubs in the same task as the config, or don't wire the
references up until those workspaces exist. Stub tsconfigs are cheap.

---

### Issue 2: Vitest couldn't compile JSX — `ReferenceError: React is not defined`

**Category:** Unexpected Error

**Sprint Task:** Task 1.3 — Renderer /app

**What happened:**
All three `HelloCoach.test.tsx` tests failed at the first `render(<HelloCoach />)` with
`ReferenceError: React is not defined`. The app's `tsconfig.json` had `jsx: "react-jsx"`
so source compiles fine via Vite, but `vitest.config.ts` didn't load
`@vitejs/plugin-react`, so Vitest's internal esbuild used the classic JSX runtime and
emitted `React.createElement` calls without an auto-import.

**Attempts made:**
1. Wrote the `.tsx` tests assuming Vitest would pick up the app's tsconfig jsx setting.
   Got ReferenceError.

**Resolution:**
Added `plugins: [react()]` to `vitest.config.ts`. All JSX tests then passed.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
When Vitest runs React tests, always include `@vitejs/plugin-react` in the vitest
config. tsconfig's `jsx: react-jsx` governs `tsc` output, not Vitest's esbuild
transform.

---

### Issue 3: Second component test saw two headings — missing test cleanup

**Category:** Unexpected Error

**Sprint Task:** Task 1.3 — Renderer /app

**What happened:**
After fixing the JSX plugin, the second HelloCoach test (`reacts to store updates`)
failed with "found multiple elements with role 'heading', name /.*/.". The first test's
DOM wasn't being torn down between tests; Testing Library's auto-cleanup wasn't wired.

**Attempts made:**
1. Ran tests after the JSX fix — first test passed, second failed with duplicates.

**Resolution:**
Added `afterEach(cleanup)` (from `@testing-library/react`) to
`tests/setup/vitest.setup.ts`.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
Testing Library's automatic cleanup only registers when Vitest's `globals: true` is on,
OR when the setup file explicitly calls `afterEach(cleanup)`. Default to the explicit
setup — avoids a class of flaky "why am I seeing the last test's DOM?" bugs.

---

### Issue 4: Playwright e2e saw empty window title — main process hit dev branch

**Category:** Failed Approach

**Sprint Task:** Task 1.5 — electron-builder packaging (surfaced when e2e ran)

**What happened:**
First e2e run: `toHaveTitle('VCD')` failed because the rendered title was `""`. Root
cause: `main/src/index.ts` had `const isDev = process.env.VCD_DEV === '1' || !app.isPackaged;`.
Running Electron directly against `main/dist/index.js` (Playwright's
`_electron.launch`), `app.isPackaged` is false, so isDev was true, so the main process
tried to load `http://localhost:5173` — which wasn't running. The window loaded
nothing, title stayed empty.

Exact error:
```
Error: expect(page).toHaveTitle(expected) failed
Expected: "VCD"
Received: ""
Timeout:  5000ms
```

**Attempts made:**
1. Initial `isDev` heuristic: `VCD_DEV === '1' || !app.isPackaged`. Failed under
   Playwright because unpacked ≠ dev.
2. Tightened to `VCD_DEV === '1'` only. Dev mode is now explicitly opt-in, and any
   unpacked-but-not-dev launch (Playwright, `electron .` against build output) loads
   the file:// renderer.

**Resolution:**
Replaced the heuristic with `const isDev = process.env.VCD_DEV === '1';`. Rebuilt main,
rerun e2e — passed.

**Diverted from original plan?** No — same approach, narrower predicate.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean (simpler predicate).
- Technical debt introduced: No.

**Lesson for future sprints:**
`app.isPackaged` is a deployment signal, not a "use dev server" signal. Always gate
dev-server loading on an explicit env var so CI and e2e can run against the unpacked
build.

---

### Issue 5: app/tsconfig.json `noEmit: true` incompatible with `composite: true`

**Category:** Unexpected Error

**Sprint Task:** Task 1.3 — Renderer /app

**What happened:**
First draft of `app/tsconfig.json` set `noEmit: true` because Vite does the actual
bundling. But `tsconfig.base.json` sets `composite: true` for project references, and
composite requires declaration emit. `tsc -b` would have errored.

**Attempts made:**
1. Drafted app tsconfig with `noEmit: true` + extends base with composite. Caught
   before running tsc.

**Resolution:**
Switched to `emitDeclarationOnly: true` with `outDir: ./.tsbuild` (so Vite's `dist/`
stays untouched by tsc). Added `.tsbuild` to excludes.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean but adds a second output directory for the app — slight
  non-standard shape.
- Technical debt introduced: Minor — `.tsbuild` directory is unusual; future contributors
  may wonder why. Documented in the tsconfig comment chain is… not present yet.

**Lesson for future sprints:**
`composite: true` + Vite-built workspaces means you need a separate tsc outDir. The
common alternative is the split `tsconfig.app.json` / `tsconfig.node.json` pattern from
Vite's template — consider adopting it if the current shape becomes confusing.

---

### Issue 6: Initial worker import used a subpath not in /shared exports map

**Category:** Diversion

**Sprint Task:** Task 1.4 — /workers stub

**What happened:**
First draft of `workers/src/noopWorker.ts` imported from
`@vcd/shared/src/ipc/workerMessages` — but `/shared/package.json` only exports `.` and
`./rng`. Caught before running.

**Attempts made:**
1. Deep subpath import. Replaced before executing.
2. Switched to `import { ipc } from '@vcd/shared'` (namespace re-export via index.ts).

**Resolution:**
Kept `.` as the only public surface for discriminated unions; used namespaced access
(`ipc.PingMessage`). Cleaner and keeps the exports map small.

**Diverted from original plan?** Yes — plan said "import schemas from /shared"; final
pattern is namespaced access rather than per-file subpath imports.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Improved — enforced encapsulation.
- Technical debt introduced: No.

**Lesson for future sprints:**
Decide the public API surface of `/shared` explicitly via its `exports` field. Default
to namespace re-exports (`* as ipc`) unless subpath imports solve a real problem.

---

## Recommendations for Sprint 2

### Carry-forward items
- **PRD exit test 2 (CI green on clean clone) is not yet verified.** The workflow YAML
  is in place but nothing has been pushed to GitHub. Before tagging
  `sprint-01-complete`, push to a remote and confirm CI passes end-to-end, including
  the Playwright job and the installer upload. This is the one acceptance criterion
  that can't be verified locally.
- **No git remote is configured.** The Volleyball dir has a git repo but no commits
  yet (parent directory issue — see note below). Decide whether to init a fresh repo
  in the project directory or untangle the existing one.

### Technical debt to address
- `.tsbuild` directory in `/app` is non-standard (Issue 5). If Sprint 2 introduces more
  Vite-built workspaces, consider switching the app to the `tsconfig.app.json` /
  `tsconfig.node.json` split pattern instead of carrying a second output dir.
- `resources/` is gitignored but still on disk (FCCD reference unpack). Confirm it's
  actually outside any commit before the first push — CLAUDE.md §Rule 1 treats it as
  a P0 hazard.

### CLAUDE.md updates to add

Recommend appending to CLAUDE.md under a new subsection (e.g., "## Gotchas accumulated"):

```markdown
## Gotchas accumulated

- **Vitest + JSX:** `vitest.config.ts` must include `@vitejs/plugin-react` in its
  `plugins` array. Without it, `.tsx` tests fail with `ReferenceError: React is not
  defined` because Vitest's internal esbuild uses the classic JSX runtime.
- **Testing Library cleanup:** `tests/setup/vitest.setup.ts` must call
  `afterEach(cleanup)` from `@testing-library/react`. Auto-cleanup does NOT trigger
  unless Vitest globals are on — we keep globals off for test-env hygiene.
- **Electron dev-mode gate:** `isDev` in `/main` must be `process.env.VCD_DEV === '1'`
  ONLY — never `!app.isPackaged`. Playwright `_electron.launch()` loads unpacked
  builds and would otherwise try to hit the Vite dev server.
- **tsconfig composite:** every workspace tsconfig that extends `tsconfig.base.json`
  gets `composite: true`. `composite` forbids `noEmit`. For Vite-built workspaces, use
  `emitDeclarationOnly: true` with a separate `outDir` (e.g., `.tsbuild`).
- **Root tsconfig references:** only list a workspace in `tsconfig.json#references`
  when its `tsconfig.json` actually exists — otherwise Vite's tsconfck crashes on
  every test run with ENOENT.
```

### PRD corrections
None. The PRD Sprint 1 deliverables and exit tests held up exactly as written.

---

## Notes on git state

`git log` returned `fatal: your current branch 'master' does not have any commits yet`,
and `git status` reported files from the entire home directory as untracked — the
initialized git repo is rooted in `C:\Users\mpkri\`, not in the project directory. This
is almost certainly unintentional (see CLAUDE.md's guidance on using normal git workflow).
Before committing Sprint 1 work, clarify whether the user wants:
  (a) a fresh `git init` inside the project directory, or
  (b) to untangle the parent-level repo.
Recommend (a).
