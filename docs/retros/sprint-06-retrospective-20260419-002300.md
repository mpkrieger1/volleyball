# Sprint 6 Retrospective

**Date:** 2026-04-19
**Sprint Goal:** User can play one complete match end to end from a debug screen.
**Status:** Complete — demoable milestone shipped. 211/211 tests green; all 4 PRD exit tests verified; both calibration surfaces clean.
**Health:** 🟡 Bumpy

---

## SPRINT 6 HEALTH SUMMARY

```
Tasks Completed:        8 / 8  (hygiene + 7 sprint tasks)
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     6
  - Failed Approaches:  1  (Electron sandbox:true silently broke preload — latent since S2)
  - Repeated Attempts:  0
  - Diversions:         1  (PlayerMatchStat persistence deferred to Sprint 12)
  - Unexpected Errors:  3  (cross-workspace relative imports; Playwright strict-mode collision; type inference issue)
  - PRD Deviations:     0
  - Missing Prereqs:    0
  - Dependency Issues:  1  (cross-workspace imports required main to add @vcd/workers dep)

Overall Sprint Health:  🟡 Bumpy. The demoable milestone eventually landed cleanly,
but the Electron sandbox bug had been silently broken for four sprints and took
significant time to diagnose once the first real end-to-end flow hit it.

Top 3 time sinks:
1. Electron sandbox:true broke preload — Failed Approach (latent 4-sprint bug)
2. Cross-workspace relative imports in new main code — Unexpected Error
3. Playwright strict-mode role collision on "Demo Dynasty" — Unexpected Error
```

---

## Issues

### Issue 1: Electron `sandbox: true` silently broke preload, undetected since Sprint 2

**Category:** Failed Approach

**Sprint Task:** Task 6.6 — Demoable E2E Playwright

**What happened:**
The demo e2e test timed out trying to find the save-name button after clicking
"Create". Extensive debugging showed the `saveSlots.create` IPC was never
invoked — no log line in `vcd-main.log` after `main window created`. After
inspecting the built preload and realizing it `require('@vcd/shared')`s a
non-whitelisted module, I traced the root cause: Electron's sandboxed preloads
(with `sandbox: true`) can only require `electron` and a small whitelist. Any
arbitrary module require FAILS SILENTLY at preload-load time, which means
`contextBridge.exposeInMainWorld('vcd', api)` never runs and `window.vcd` is
undefined.

This bug had been **latent since Sprint 2**. Sprint 2's preload added
`require('@vcd/shared')` for the saveSlotIpc channels. The Sprint 1 smoke test
passed only because it checked the window title (no `window.vcd` usage).
Sprint 2's e2e for Save Slots was replaced in Sprint 4 with an even weaker
"Save slots heading visible" check — which also passes without `window.vcd`
because SaveSlots renders its empty state even if `list()` throws. Sprint 6's
full end-to-end flow was the first test that actually *used* the bridge.

**Attempts made:**
1. Noticed 30s Playwright click timeout on "Demo Dynasty" button. Assumed slow
   seed on save creation. Increased test timeout to 120s. Same failure.
2. Added console.error logging inside `createSaveSlot` to trace. Log never
   fired. Confirmed IPC handler wasn't reached.
3. Added `waitForTimeout(2000)` + `innerText` dump before the failing click.
   Page text showed the save DID appear (seed DID work). Failure was
   elsewhere.
4. Wait — if the save DID appear, why was the click timing out? Read the
   error message more carefully: Playwright strict-mode violation matched
   TWO buttons for `{ name: 'Demo Dynasty' }`. That's Issue 3 below.
5. Separately, the earlier theory (preload broken, IPC never reached) seemed
   contradicted by the save appearing. So was the sandbox actually the issue?
   Reviewed the first trace more carefully: the "Demo Dynasty" button NEVER
   appeared because the earlier `saveSlots.create` call DID hang due to
   sandbox blocking preload. Flipped `sandbox: false`. Then separately hit
   Issue 3.

**Resolution:**
`webPreferences.sandbox` set to `false`. Security model remains strong:
`contextIsolation: true` + `nodeIntegration: false` prevents renderer-side
exploits. Sandbox is an *additional* layer that only helps if you bundle the
preload as a self-contained script (esbuild). Future work: bundle the preload
and flip sandbox back to true.

**Diverted from original plan?** No — the plan didn't address sandbox; this
was a latent bug from Sprint 2.

**Impact on sprint:**
- Time cost: High. Biggest single debugging session of the sprint.
- Code quality: Pragmatic fix. Better long-term is bundling preload.
- Technical debt introduced: Yes — `sandbox: false` should be revisited when
  preload bundling lands. Documented in the file comment and CLAUDE.md.

**Lesson for future sprints:**
**E2E tests must exercise the IPC bridge end-to-end, not just render the entry
screen.** The Sprint 2/4 smoke tests that only asserted "heading visible"
silently masked a critical security-config regression for four sprints. Every
screen with an IPC-backed data source should have an e2e that actually
triggers IPC.

---

### Issue 2: Cross-workspace relative imports in new main code (violated Sprint 3's own ESLint rule)

**Category:** Unexpected Error

**Sprint Task:** Task 6.3 — simulateMatch IPC + DB persistence

**What happened:**
First build of `main/src/match/simulateAndPersist.ts` imported
`{ simulateMatch } from '../../../workers/src/sim/match'`. This violated the
Sprint 3 ESLint rule forbidding cross-workspace relative imports. But it
wasn't even flagged by ESLint in time because it failed at the `tsc -b` step
first, with:

```
error TS6059: File 'workers/src/sim/rally.ts' is not under 'rootDir'
  'main/src'. 'rootDir' is expected to contain all source files.
```

The same mistake documented in the Sprint 2 retro, immortalized in the Sprint
3 CLAUDE.md "gotchas" section, and enforced by a lint rule — I wrote it again
anyway.

**Attempts made:**
1. Wrote the relative import. tsc errored.
2. Added `@vcd/workers` as a dep in `main/package.json`, switched to
   `import { simulateMatch, type TeamMatchState } from '@vcd/workers'`. Build
   clean.

**Resolution:**
Added `@vcd/workers` workspace dependency to main. Updated the import.

**Diverted from original plan?** No — plan assumed the discipline would hold.

**Impact on sprint:**
- Time cost: Low (~2 min).
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
The ESLint rule from Sprint 3 catches this when running lint, but `tsc -b`
catches it EARLIER (at build time). Running `tsc -b` during development is
faster feedback than waiting for the lint gate. Consider a watch-mode build
to surface these in real-time.

---

### Issue 3: Playwright strict-mode role collision — "Demo Dynasty" matched two buttons

**Category:** Unexpected Error

**Sprint Task:** Task 6.6 — Demoable E2E

**What happened:**
After fixing the sandbox issue, the e2e still failed. Error:

```
Error: locator.click: Error: strict mode violation:
  getByRole('button', { name: 'Demo Dynasty' }) resolved to 2 elements:
    1) <button type="button" class="save-slots__name-btn">Demo Dynasty</button>
    2) <button type="button" aria-label="Delete save Demo Dynasty">Delete</button>
```

Playwright's accessible-name matcher is substring by default. Both the
name-btn ("Demo Dynasty") AND the delete button (aria-label includes "Demo
Dynasty") matched.

**Attempts made:**
1. `getByRole('button', { name: 'Demo Dynasty' })`. Ambiguous; strict-mode violation.
2. Added `exact: true` to narrow match to "Demo Dynasty" exactly. Clean.

**Resolution:**
`getByRole('button', { name: 'Demo Dynasty', exact: true })`.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low once the error message was read.
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
When two buttons on a screen share a substring (e.g., a name-link + a delete
button referring to the same row), prefer `exact: true` or scope via
`within`. The S2 SaveSlots screen already paid this tax — it should be the
default for list-row buttons from now on.

---

### Issue 4: `Window['vcd']` declared twice via different `declare global` blocks conflicted

**Category:** Unexpected Error

**Sprint Task:** Task 6.4 — Match Hub renderer screen

**What happened:**
Two store files (`useSaveSlotsStore.ts` and `useMatchHubStore.ts`) each had
`declare global { interface Window { vcd: ... } }`. TypeScript merges
interface declarations, but property types are not mergeable — you can't
declare `vcd` with shape A in one file and shape A & B in another. TS picked
the first one and failed the second:

```
error TS2339: Property 'match' does not exist on type
  '{ version: string; saveSlots: { ... } }'.
```

**Attempts made:**
1. Attempted to use intersection inside one of the `declare global` blocks
   (`vcd: Window['vcd'] & { match: ... }`). TS rejected — can't self-reference
   during declaration.
2. Extracted a single `app/src/types/window.d.ts` declaring both shapes in
   one place. Removed the per-store `declare global` blocks.

**Resolution:**
Single central `Window['vcd']` type file.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Improved (single source of truth).
- Technical debt introduced: No. If anything, retired future debt — adding
  more IPC surfaces now only touches one declaration.

**Lesson for future sprints:**
Don't scatter `declare global` across feature stores. Put all ambient module
augmentations in one `.d.ts` file.

---

### Issue 5: Type inference `MatchBoxScore = Response extends {...} ? B : never` returned `never`

**Category:** Unexpected Error

**Sprint Task:** Task 6.4

**What happened:**
First draft of `useMatchHubStore.ts` tried to derive the box-score type from
the IPC response via conditional-type inference:

```ts
type MatchBoxScore = matchIpc.SimulateMatchResponse extends { ok: true; boxScore: infer B }
  ? B
  : never;
```

Zod's `SimulateMatchResponse` is a discriminated union, and the conditional
type couldn't narrow into the `ok: true` branch — it resolved to `never`.
Downstream `lastBoxScore: MatchBoxScore | null` became `null | never` which
broke all the places that tried to read `.home.players`.

**Attempts made:**
1. Conditional type via `infer`. Resolved to `never`.
2. Imported `sim.MatchBoxScore` directly. Immediate success.

**Resolution:**
`type MatchBoxScore = sim.MatchBoxScore`. The zod-inferred type from the sim
module is the canonical source anyway.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low.
- Code quality: Improved.
- Technical debt introduced: No.

**Lesson for future sprints:**
Don't try to derive types from discriminated-union IPC responses via
`infer` — the narrowing is fragile. Just re-import the canonical type.

---

### Issue 6: PlayerMatchStat persistence deferred to Sprint 12

**Category:** Diversion

**Sprint Task:** Task 6.3 — simulateMatch IPC + DB persistence

**What happened:**
Initial design wrote per-player PlayerMatchStat rows during `simulateAndPersistMatch`.
The Prisma schema's `PlayerMatchStat.playerId` is a required foreign key into
`Player`. Sprint 6 doesn't have Player rows (that's Sprint 12). I attempted
a synthetic `playerId = "${teamId}#${slotIndex}"` string to fake it, but
SQLite's FK constraint rejected the write.

**Attempts made:**
1. Synthetic playerId strings. FK constraint rejection.
2. Considered upserting placeholder Player rows. Would require generating 6
   players × 2 teams with 9 ratings each per match, polluting the schema with
   throwaway data.
3. Removed PlayerMatchStat persistence entirely. The per-player stats live in
   `Match.boxScoreJson` (serialized `MatchBoxScore`) which is all the Match
   Hub needs. When Sprint 12 lands real Player generation, PlayerMatchStat
   writes resume with real FKs.

**Resolution:**
Per-player stats persisted into the `Match.boxScoreJson` column only.
Documented inline that PlayerMatchStat rows arrive in Sprint 12.

**Diverted from original plan?** Yes. Plan explicitly said "12 PlayerMatchStat
rows written per match". Revised scope to "per-player stats persisted into
boxScoreJson; PlayerMatchStat rows deferred."

**Impact on sprint:**
- Time cost: Low.
- Code quality: Clean — boxScoreJson is the right serialization for now.
- Technical debt introduced: Yes — a Sprint 12 migration will need to either
  backfill PlayerMatchStat from historical boxScoreJson blobs or drop the
  requirement. Both are fine; document the backfill plan in Sprint 12's plan.

**Lesson for future sprints:**
When a plan's implementation step requires a dependency that's two sprints
out, either (a) scope the step to what's achievable now, or (b) pull the
dependency forward. Don't plan against a nonexistent prerequisite.

---

## Seed extraction (not an issue, but worth noting)

Sprint 2's `prisma/seed.ts` was a CLI-only seeder. Sprint 6 needed the same
logic for in-process save-slot creation. Extracted the core into
`shared/src/seed/leagueSeed.ts` with `seedLeagueInto(prisma, repoRoot)`.
Both the CLI and save-slot creation now delegate to the shared function.
No tests broke; clean refactor. But it's a reminder that **CLI-side logic
that may eventually run inside the main process should live in shared
from day one**, not in a prisma/ script that's inaccessible from Electron
workspaces.

---

## Recommendations for Sprint 7

### Carry-forward items
- **Git remote push.** Still outstanding across 6 sprints. Sprint 7 is the
  first sprint after the demoable milestone — a natural moment to finally
  push the tag.
- **PlayerMatchStat backfill plan** — document in Sprint 12's plan how to
  reconcile the boxScoreJson column with real Player row creation.
- **Preload bundling (to re-enable sandbox:true)** — not urgent, but worth
  ~2 hours in a polish sprint to flip sandbox back on. Sprint 19 is a good
  candidate.

### Technical debt to address
- `sandbox: false` in windowConfig. Bundle the preload via esbuild to flip
  back to `true` when UI surface is settled.
- `Window['vcd']` declared in `app/src/types/window.d.ts` uses a
  `VcdApiSurface` global interface that slightly overbuilds the type.
  Could be tightened once the IPC surface stabilizes.
- The backwards-compat flat-rotator path in `simulateRally` is now definitely
  unused by the match hub. Sprint 7 (scheduler) or Sprint 8 (season worker)
  can delete it.

### CLAUDE.md updates to add

Append a `### From Sprint 6` subsection under "Gotchas accumulated":

```markdown
### From Sprint 6
- **Electron sandboxed preloads cannot `require('@vcd/shared')`** (or any
  non-whitelisted module). Set `webPreferences.sandbox: false` OR bundle the
  preload into a self-contained script. `contextIsolation: true` +
  `nodeIntegration: false` provide sufficient security for a local app.
- **E2E tests must exercise the IPC bridge, not just render the entry
  screen.** A test that only asserts "heading visible" silently masks
  catastrophic preload regressions. Every screen with IPC-backed data
  should have an e2e that triggers at least one IPC round-trip.
- **Playwright `getByRole` matches accessible name as substring by default.**
  When two buttons share a substring (row's name link + the row's delete
  button), always use `exact: true` or scope via `within`.
- **Don't spread `declare global { interface Window { vcd: ... } }`** across
  feature files. TS interface merging works for nested properties but fails
  when the same property (`vcd`) has different shapes in different
  declarations. Put the entire `Window['vcd']` type in one `.d.ts` file.
- **Don't derive types from discriminated-union IPC responses via `infer`.**
  Conditional narrowing into a union branch is fragile and resolves to
  `never` more often than you'd expect. Re-import the canonical zod-inferred
  type instead.
- **CLI-side logic that may run in-process later should live in `@vcd/shared`
  from day one.** Sprint 2's `prisma/seed.ts` had to be extracted in Sprint 6
  when save-slot creation needed it. Avoid re-doing this for future CLI
  scripts.
- **PlayerMatchStat rows are deferred until Sprint 12.** Sprint 6 persists
  per-player stats into `Match.boxScoreJson` only. The Sprint 12 plan must
  include a backfill or redesign step for `PlayerMatchStat.playerId`.
```

### PRD corrections
None required. Sprint 6's exit tests were all achievable and landed cleanly
once the sandbox bug was caught.

Worth flagging for future PRD edits (not requested now): Sprint 6's
"Full box score schema populated per match" is ambiguous about whether
persistence = Match.boxScoreJson or PlayerMatchStat rows. Sprint 12's plan
should clarify this if the latter is the intended target.

---

## Notes

Test count progression: S1 26 → S2 83 → S3 119 → S4 156 → S5 189 → S6 **211**.
E2E test count: 1 → 2 (smoke + demo). Engine perf unchanged (match mean
1.14 ms, p99 4.78 ms — 130× headroom vs PRD's 150 ms budget).

The Sprint 6 demoable milestone is the first user-facing end-to-end flow
that exists in the project. Every prior sprint's e2e was a smoke test for
infrastructure. This sprint's debugging-heavy middle section (the sandbox
latent bug) is a direct consequence of that: the first real integration
tests always surface accumulated infrastructure issues.

**The Sprint 2 retro's recommendation — "every screen with an IPC-backed
data source should have an e2e that actually triggers IPC" — was written
before Sprint 2's e2e was even committed.** If we had followed it then,
the sandbox bug would have been caught four sprints earlier. Take retro
recommendations more seriously going forward.
