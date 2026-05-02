# Sprint 11 Retrospective

**Date:** 2026-05-03
**Sprint Goal:** Post-season is playable and visually legible.
**Status:** Complete — all 3 PRD S11 exit tests green; full post-season integration (seed → 13 regular-season weeks → CT → NCAA → champion) passes.
**Health:** 🟢 Clean

---

## SPRINT 11 HEALTH SUMMARY

```
Tasks Completed:        11 / 11  (10 sprint tasks + 11.0 hygiene)
Tasks Partially Done:   none
Tasks Skipped:          git tag (standing "no pushes yet" directive — 11 sprints now)

Issues Encountered:     6
  - Failed Approaches:  0
  - Repeated Attempts:  0
  - Diversions:         2  (schema mid-sprint extension; poolRegistry extraction)
  - Unexpected Errors:  4  (Prisma client stale; ESLint determinism catch; Math.random
                            in test; getByText multiple-match; scope of PRD exit test 2)
  - PRD Deviations:     1  (exit test 2 scoped to post-season rounds only — see Issue 4)
  - Missing Prereqs:    0
  - Dependency Issues:  0

Overall Sprint Health:  🟢 Clean. The heaviest sprint of the 26 so far by LOC
(~22 new files, ~2,500 LOC across backend + UI + tests) executed essentially
as planned. No algorithm rewrites. No pivots. Two minor plan-gaps required
mid-course schema + pool-registry extractions; both landed cleanly. The
usual Sprint 10 weekPerf flake recurred — unchanged.

Top 3 time sinks:
1. Adding bracketSlot + bracketGroupKey mid-sprint (~8 min) — Diversion
2. Pool-registry extraction so postseasonHandlers could share the pool (~5 min)
3. Fixing the 4 minor test/lint nits in final gate (~5 min total)
```

---

## Issues

### Issue 1: Schema iteration — added bracketSlot + bracketGroupKey mid-sprint

**Category:** Diversion

**Sprint Task:** 11.1 — Schema migration

**What happened:**
The plan specified two schema additions: `Match.tournamentRound` and
`Season.nationalChampionTeamId`. While writing the round-advancer I
realized I also needed deterministic within-round ordering to pair
winners 2i/2i+1 into the next round, and a way to group matches by
bracket scope (conference id for CT; region name for NCAA regional
rounds; 'NCAA' for global rounds).

**Attempts made:**
1. Started without the extra columns — planned to use `Match.date` as a
   proxy for ordering. Rejected: clutters semantics and makes UI
   date display awkward.
2. Considered deriving the bracket group from team membership — works
   for CT (both teams share a conference) but not for NCAA regional
   rounds (region info isn't on the teams; it's on BracketEntry).
3. Added `bracketSlot` (Int?) and `bracketGroupKey` (String?) to the
   migration file BEFORE it was applied anywhere. Clean.

**Resolution:**
Extended the pending migration. No schema churn — no migration has
ever been applied outside of fresh save-slot creation.

**Diverted from original plan?** Yes. The plan called for a 2-column
migration; the final migration adds 4 columns to Match + 1 to Season.

**Impact on sprint:**
- Time cost: Low (~8 min including test updates).
- Code quality: Better than the proxy approach. Columns are
  semantically named and self-documenting.
- Technical debt introduced: No.

**Lesson for future sprints:**
**When a sprint plan touches Prisma schema, sketch at least one
concrete Match row for every tournament round BEFORE writing the
migration.** I planned the rounds abstractly and only discovered the
need for slot/group fields when writing the advancer. A 60-second
mental walkthrough of "what columns does a CT_R1 match need vs a
NCAA_FF match" would have caught this in plan phase.

---

### Issue 2: Pool-registry extraction

**Category:** Diversion

**Sprint Task:** 11.4 — Postseason IPC handlers

**What happened:**
`seasonHandlers.ts` owned a private `Map<slotId, SimWorkerPool>` with a
`getOrCreatePool` helper function. `postseasonHandlers` needs the same
pool (per slot, one pool instance) to dispatch tournament matches.
Importing a private function was wrong; duplicating the map would let
two pools race the same save file.

**Attempts made:**
1. Considered exporting `getOrCreatePool` from `seasonHandlers.ts`
   directly. Works but couples two IPC files.
2. Extracted `main/src/season/poolRegistry.ts` with shared
   `getOrCreatePool` + `disposeAllPools`. Updated seasonHandlers to
   use it. Postseason imports the same.

**Resolution:**
Clean extraction. `disposeAllSeasonPools` (exported for
`app.before-quit`) now just calls `disposeAllPools()`.

**Diverted from original plan?** Yes. Plan didn't anticipate the
factoring; it would have worked either way.

**Impact on sprint:**
- Time cost: Low (~5 min).
- Code quality: Strictly better — lifecycle is in one place.
- Technical debt introduced: No.

**Lesson for future sprints:**
**When two IPC modules need the same per-slot resource, extract a
shared registry module first, wire both handlers to it.** Don't
import private helpers from a sibling IPC file.

---

### Issue 3: Prisma client stale after schema edit

**Category:** Unexpected Error

**Sprint Task:** 11.4 — Postseason IPC handlers (surfaced at typecheck)

**What happened:**
After adding `Match.bracketSlot` and `Match.bracketGroupKey` to
`schema.prisma`, the first full `npm run typecheck` exploded with
20+ errors like:

```
error TS2353: Object literal may only specify known properties, and
'bracketGroupKey' does not exist in type
'MatchOrderByWithRelationInput'.
```

All from the generated Prisma client still reflecting the old schema.

**Attempts made:**
1. Ran `npx prisma generate`. Typecheck clean immediately after.

**Resolution:** One command.

**Diverted from original plan?** No — this is standard Prisma workflow.

**Impact on sprint:**
- Time cost: Trivial.
- Code quality: N/A.
- Technical debt introduced: No.

**Lesson for future sprints:**
**Always run `npx prisma generate` after any schema.prisma edit,
before running typecheck.** Already known but worth reinforcing — the
failure mode is noisy (20+ errors) and misleading unless you know to
look at the client generation step.

---

### Issue 4: PRD exit test 2 scope — "every tournament match"

**Category:** PRD Deviation

**Sprint Task:** 11.8 — Full post-season integration test

**What happened:**
First-pass assertion for PRD exit test 2 ("every tournament match
outcome is preserved in Match rows with isTournament = true") was
written as: every `isTournament=true` match has a non-null
`tournamentRound` AND `winnerId`. The test failed:

```
AssertionError: expected null to be truthy (at tournamentRound)
```

Investigation: Sprint 7's schedule generator already flags some
early-season non-conference invitational matches as
`isTournament=true` without a post-season round label. Those aren't
NCAA or CT tournaments — they're pre-season tournaments like an
Invitational hosted by a team in week 1.

**Attempts made:**
1. Original: `where: { isTournament: true }`. Failed — picked up
   regular-season invitational matches.
2. Scoped: `where: { tournamentRound: { in: postseasonRounds } }`.
   Pass. Asserts that all 9 post-season round labels are set on the
   matches I care about.

**Resolution:**
Scoped the assertion to post-season tournament rounds only. Added a
comment explaining the scoping and that the regular-season
invitational flag is covered by Sprint 7's schedule invariants.

**Diverted from original plan?** Minor. Still satisfies the PRD's
intent — PRD §5 Sprint 11 exit test 2 is clearly about the post-season
"tournament" (CT + NCAA), not pre-season invitationals which are a
Sprint 7 concept.

**Impact on sprint:**
- Time cost: Low (~5 min to diagnose + fix).
- Code quality: Clearer assertion now.
- Technical debt introduced: No. Flag for PRD edit: Sprint 11 exit
  test 2 should be reworded to "every CT or NCAA tournament match" or
  the PRD glossary should define "tournament match" scope.

**Lesson for future sprints:**
**`isTournament=true` is ambiguous at this codebase scale.** Past
sprints use the flag for both pre-season invitationals AND
post-season brackets. A future `Match.tournamentType` enum
('INVITATIONAL' | 'CONFERENCE_TOURNEY' | 'NCAA') would disambiguate.
Not worth doing now; flag for Sprint 12+.

---

### Issue 5: ESLint caught Math.random() in test fixture

**Category:** Unexpected Error

**Sprint Task:** 11.10 — Final gate

**What happened:**
Final `npm run check` blocked with:

```
tests/unit/BracketView.test.tsx
  26:18  error  Use the seeded RNG from @vcd/shared/rng — Math.random
  breaks determinism (CLAUDE.md §Determinism)
  no-restricted-syntax
```

My test fixture factory used `Math.random().toString(36)` to generate
unique-ish match IDs. The project's Sprint-1 determinism rule forbids
this.

**Attempts made:**
1. Replaced `Math.random()` with `crypto.randomUUID()` (per Sprint 8
   retro's explicit guidance on non-sim random IDs).

**Resolution:** One-line fix.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Trivial.
- Code quality: Same.
- Technical debt introduced: No.

**Lesson for future sprints:**
**Use `crypto.randomUUID()` for test-fixture identifiers from the
start.** This is the 3rd sprint where this rule has bitten (Sprints
8, 9, 11). CLAUDE.md already has this guidance. Next time I write a
factory, reach for `crypto.randomUUID()` by default.

---

### Issue 6: ESLint caught unused var + RTL getByText multiple matches

**Category:** Unexpected Error

**Sprint Task:** 11.10 final gate (unused var) + 11.9 (RTL)

**What happened:**

(a) `advanceTournamentRound.ts`:

```
86:11  error  'isCtRoundLike' is assigned a value but never used
```

I'd planned to use this to switch next-round group-key behavior, but
the final algorithm doesn't need it (NCAA_E8 → FF is special-cased
inline). Dead var left behind. Deleted.

(b) `ChampionCrown.test.tsx`: `getByText(/Finalist College/)` threw
because the school name appears twice — once in the final-game card
paragraph, once in the path table row (the school span inside the
opponent column). Switched to `getAllByText(...).length > 0`.

**Attempts made:**
Both were one-line fixes.

**Resolution:** Immediate.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Trivial.
- Code quality: Cleaner.
- Technical debt introduced: No.

**Lesson for future sprints:**
**When a component renders the same text in multiple locations (a
headline + a table cell), always assert with `getAllByText` or
`within(scope).getByText` — `getByText` is strict-single-match and
will error.**

---

## Notable positives (not issues)

- **11 tasks in a row, no rewrites.** Second time this year (after
  Sprint 10). The cost of a detailed TDD-first plan shows up here.
- **The `advanceTournamentRound` round-agnostic pattern.** One function
  handles CT R1/SF/F + NCAA R64/R32/S16/E8/FF/CHAMP — including the
  special-case FF regional pairing. ~230 LOC total. The bracket-slot +
  group-key design (Issue 1) paid for itself.
- **Full post-season runs in ~100s** end-to-end in the integration
  test: 13 regular-season weeks + 3 CT rounds + 6 NCAA rounds. No perf
  concerns.
- **No flakes in default suite** (other than the known Sprint 10
  weekPerf under concurrent load — unchanged). 318/319 pass.
- **UI state preservation verified.** The state-preservation test
  (Zustand singleton survives `useNavStore` screen switch) proves PRD
  exit test 3 at the unit-test level — no need for a brittle Playwright
  drilldown.
- **Test count progression:** S1 26 → S2 83 → S3 119 → S4 156 →
  S5 189 → S6 211 → S7 239 → S8 254 → S9 286 → S10 298 →
  S11 **318** (+ 6 postseason integration tests).

---

## Recommendations for Sprint 12

### Carry-forward items
- **Nothing blocking.** All S11 tasks complete; post-season is fully
  playable via the BracketView screen.
- **Git remote push** still outstanding (11 sprints running). Per
  standing directive, not blocking.
- **Playwright e2e for BracketView** was planned as a deferral
  candidate; in the end I skipped it (the unit test + axe sweep
  covered the exit tests). Worth adding as a Sprint 12 hygiene task
  if not addressed. Sprint 6 retro warned that skipping e2e canaries
  on a new IPC surface masks preload regressions.

### Technical debt to address
- **`isTournament=true` ambiguity.** Used for both pre-season
  invitationals (Sprint 7) and post-season brackets (Sprint 11).
  A future `Match.tournamentType` discriminator would eliminate
  Issue 4's scoping workaround. Not urgent.
- **ChampionCrown "Start next season" button** is a stub. Sprint 12
  is player generation + offseason; wire it up there.
- **Region-host preference in seeding** still deferred from Sprint 10.
  The bracket UI now exposes the arbitrary region assignments; if
  they look off, Sprint 12+ can add a region-swap heuristic under
  the ±2-line guardrail.
- **weekPerf flake** under concurrent vitest. Third sprint in a row.
  A `test.sequential` on just that file would stop the noise.

### CLAUDE.md updates to add

Append a `### From Sprint 11` subsection:

```markdown
### From Sprint 11
- **Plan Prisma schema by walking one concrete row per variant.**
  Before committing to migration columns, write out "what does a
  CT_R1 match row look like?" vs "what does a NCAA_FF row look like?"
  — discovers missing columns (bracketSlot, bracketGroupKey) that
  abstract planning misses.
- **Per-slot worker pool lives in a dedicated registry module
  (`main/src/season/poolRegistry.ts`)**, not inside any IPC file.
  Any new handler that dispatches work to the pool imports from
  there.
- **`isTournament=true` is ambiguous — includes both pre-season
  invitationals and post-season brackets.** To filter for "real"
  tournament matches, use `tournamentRound IN (...)`. A future
  `Match.tournamentType` enum would fix this.
- **In RTL, `getByText` throws on multiple matches.** For strings
  that render in both a headline and a table cell (e.g., a school
  name), use `getAllByText` or scope with `within(...)`.
- **Round-agnostic dispatchers** (`advanceTournamentRound`) are a
  cleaner pattern than per-round functions when the mechanics are
  identical: load unplayed matches → dispatch to worker pool →
  atomic write of results + next-round rows. Pair winners by
  `bracketSlot` 2i/2i+1 within `bracketGroupKey`.
```

### PRD corrections
- **Sprint 11 exit test 2** should be reworded from "every tournament
  match outcome is preserved in Match rows with isTournament = true"
  to "every **conference-tournament or NCAA-tournament** match outcome
  …" — or add a glossary entry defining "tournament match". Sprint 7
  flags pre-season invitationals with the same flag, so the current
  wording is technically satisfied by matches the test isn't supposed
  to care about.
- **Conference tournament size unspecified.** Sprint 11 chose "8-team
  bracket if >= 8 teams; 4-team if 4-7 teams; 2-team if 2-3 teams".
  PRD should document the bracket-size heuristic (or specify a
  different one for v1).
- **NCAA round names.** Sprint 11 uses the standard 6-round structure
  (R64/R32/S16/E8/FF/CHAMP). PRD mentions "Final Four" but doesn't
  enumerate all 6; worth a one-line addition.

---

## Notes

Sprint 11 was the largest sprint of the 26 by raw surface area (backend
services + IPC + two new renderer screens + store + Prisma migration +
integration tests). Executing it cleanly without an algorithm rewrite
or scope cut is a strong validation of the TDD-first planning workflow.
The plan file's "deferral candidates" (ChampionCrown path card,
Playwright e2e) did not need to be invoked — only the Playwright e2e
was skipped, and that's a known Sprint 6 risk pattern.

The second clean sprint in a row (Sprint 10 and 11). The pattern
holds: when inputs and outputs are well-specified (selection + seeding
in S10; round-pair-by-slot + advance-round in S11), implementation
converges fast. Sprint 9's mid-sprint inertia rewrite remains the
outlier.

Running tally of recurring lessons:
1. **"Run `npm run check` per task"** — Sprints 3, 5, 8, 9. Not a
   recurrence in 10 or 11; habit internalized.
2. **Slot-filling bugs need scale tests** (Sprint 9) — Sprint 11's
   integration test IS the scale test (350-team field, 270+
   tournament matches). No bugs surfaced.
3. **Weighted-formula fixtures need varied records** (Sprint 10) —
   N/A this sprint.
4. **Plan Prisma schema by walking row examples** (new, Sprint 11) —
   goes into CLAUDE.md.
