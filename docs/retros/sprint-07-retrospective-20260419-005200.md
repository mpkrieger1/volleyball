# Sprint 7 Retrospective

**Date:** 2026-04-19
**Sprint Goal:** A full 2026 season schedule generates correctly for every D-I team.
**Status:** Complete — all 4 PRD exit tests verified (exit test 2 cap amended from 32 to 40 by plan); 239/239 tests green.
**Health:** 🟢 Clean

---

## SPRINT 7 HEALTH SUMMARY

```
Tasks Completed:        9 / 9  (hygiene + 8 sprint tasks)
Tasks Partially Done:   none
Tasks Skipped:          none

Issues Encountered:     3
  - Failed Approaches:  0
  - Repeated Attempts:  0
  - Diversions:         1  (PRD exit test 2 cap: 32 → 40, flagged in plan)
  - Unexpected Errors:  2  (type-inference recurrence; react/no-unescaped-entities)
  - PRD Deviations:     1  (exit test 2 cap amendment — necessary for self-consistency)
  - Missing Prereqs:    0
  - Dependency Issues:  0

Overall Sprint Health:  🟢 Clean. The cleanest sprint since S4. Algorithmic work
(conference round-robin, non-conf pairing, date assignment) landed first try.
The PRD contradiction was caught in planning, not during execution.

Top 3 time sinks (all small):
1. PRD math contradiction between exit tests 1 and 2 — PRD Deviation / plan-time
2. Type-inference-from-discriminated-union bug recurred — Unexpected Error (known gotcha)
3. React unescaped-quotes lint error — Unexpected Error (trivial)
```

---

## Issues

### Issue 1: PRD exit test 2 contradicts exit test 1 for P4 conferences

**Category:** PRD Deviation

**Sprint Task:** Task 7.7 — PRD invariant test suite (caught during planning)

**What happened:**
PRD Sprint 7 exit tests state:
1. "Every team in every conference plays every other conference member exactly
   twice."
2. "Every team has between 28 and 32 total regular-season matches (NCAA cap)."

These are contradictory for 18-team conferences (ACC, Big Ten):
- Strict double round-robin: 2 × 17 = **34 conference matches alone**.
- Plus ≥ 0 non-conference: total ≥ 34, exceeding the 32 cap.

CLAUDE.md's invariants section reinforces exit test 1 as a hard constraint
("Every team in a conference plays every other member exactly twice per
regular season"). I preserved that invariant and amended exit test 2.

**Attempts made:**
1. Flagged in the Sprint 7 plan's Risk & Notes section during planning. User
   confirmed "proceed with a" (the amendment).
2. Implementation: exit test 2 asserts `[28, 40]` instead of `[28, 32]`. The
   test file has a prominent comment block explaining the amendment.

**Resolution:**
Invariant test uses `[28, 40]`. PRD needs a one-line edit in the Sprint 7
section; `PRD.md` §5 Sprint 7 exit test 2 should read `[28, 40]` or
equivalent. Not done this sprint (scope-discipline); logged for a future
PRD sweep.

**Diverted from original plan?** No — the plan explicitly proposed the
amendment and the user approved it before execution.

**Impact on sprint:**
- Time cost: Low (caught in planning).
- Code quality: Clean. Amendment documented inline.
- Technical debt introduced: Yes — PRD has a ~1-line stale number until
  the sweep lands.

**Lesson for future sprints:**
**Reading the PRD's exit tests arithmetically during planning catches
self-contradictions BEFORE execution**, not after. Sprint 7's plan opened
with exactly that math check and saved us. Make this a planning-stage
habit.

---

### Issue 2: Type-inference-from-discriminated-union bug RECURRED in `useScheduleStore`

**Category:** Unexpected Error

**Sprint Task:** Task 7.6 — Schedule view UI stub

**What happened:**
First draft of `useScheduleStore.ts`:

```ts
stats: scheduleIpc.GenerateScheduleResponse extends { ok: true; stats: infer S } ? S : null;
```

Same pattern as Sprint 6's `useMatchHubStore`, and TypeScript narrowed the
conditional into the discriminated-union's error branch, resolving `stats`
to `never`. Downstream `stats.totalMatches` failed to typecheck.

The CLAUDE.md "Gotchas accumulated" section has a bullet specifically
warning about this, added in the Sprint 6 retro. I wrote the same bug
anyway.

**Attempts made:**
1. Conditional type via `infer`. TS resolved to `never`.
2. Declared a named `ScheduleStats` type with the 4 fields explicitly.
   Updated the store to use `ScheduleStats | null`. Typecheck clean.

**Resolution:**
Named type. Same fix as Sprint 6.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low (~2 min once the typecheck flagged it).
- Code quality: Clean.
- Technical debt introduced: No.

**Lesson for future sprints:**
A CLAUDE.md gotcha saying "don't do X" does not prevent me from doing X on
a new screen, if I'm writing the store from a similar template. **Consider
linting this pattern specifically** via an ESLint `no-restricted-syntax`
rule matching `TSConditionalType` inside Zustand store types, or at least a
code-review checklist item.

---

### Issue 3: React `no-unescaped-entities` lint error on double quotes in JSX

**Category:** Unexpected Error

**Sprint Task:** Task 7.6 — Schedule view UI

**What happened:**
Wrote `<p>No matches scheduled. Click "Generate 2026 schedule".</p>`. ESLint
flagged the embedded double quotes:

```
error  `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`
  react/no-unescaped-entities
```

The rule is cosmetic — raw `"` in JSX renders fine, but the rule enforces
HTML-entity-escaping for accessibility/cross-browser hygiene.

**Attempts made:**
1. Raw `"Generate 2026 schedule"`. Lint errored.
2. Removed the quoted phrase entirely: "Click the Generate button". Clean.

**Resolution:**
Rephrased without quotes.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Trivial.
- Code quality: Fine.
- Technical debt introduced: No.

**Lesson for future sprints:**
Avoid double-quotes inside JSX text literals; use a visually distinct
indicator or drop the quotes. (Auto-fix via `--fix` would have worked too.)

---

## Notable positives (not issues)

- **The plan's PRD-arithmetic pass caught a contradiction before coding.**
  Sprint 4/5/6 plans did NOT do this math check; Sprint 7 did, and it
  saved a late-sprint rewrite.
- **Algorithmic work landed first try.** Conference circle-method,
  non-conf greedy with travel sanity, date-assignment first-fit — all
  tests passed on first build. This is the first sprint where pure
  algorithmic code (not integration/plumbing) worked immediately.
- **Byte-identical regeneration invariant held.** Same seed produces
  byte-identical Match rows across 5,600 matches. Determinism discipline
  paying off.
- **Preload-bridge e2e canary (Task 7.0) exists now.** S6 retro's top
  recommendation landed as a mechanism, not a document. Future sandbox
  regressions caught immediately.

---

## Recommendations for Sprint 8

### Carry-forward items
- **PRD §5 Sprint 7 exit test 2** needs a one-line update (32 → 40) in a
  future PRD sweep. Not in Sprint 8's scope; flag as documentation debt.
- **Git remote push.** Still outstanding (7 sprints). Sprint 8 is the
  season worker and will exercise parallelism — another natural push
  point.

### Technical debt to address
- None new this sprint. Sprint 6's deferred items (preload bundling to
  re-enable sandbox:true; PlayerMatchStat persistence) unchanged.
- Sprint 3's flat-rotator fallback still present; still unused. Sprint 8
  or 9 good window to delete.

### CLAUDE.md updates to add

Append a `### From Sprint 7` subsection:

```markdown
### From Sprint 7
- **Read PRD exit tests arithmetically during sprint planning.** Sprint 7's
  exit test 1 (strict double round-robin) contradicts exit test 2 ([28, 32]
  cap) for 18-team conferences — trivially provable (2×17 = 34 > 32). The
  Sprint 7 plan caught this pre-execution; future plans should explicitly
  do the math.
- **`Team.region`** is seeded from `TEAM_REGION_OVERRIDES` in
  `@vcd/shared/seed/teamRegions.ts`. Teams not in the override map default
  to `'CENTRAL'`. Only used for scheduler travel sanity — not for
  conference alignment or geography elsewhere.
- **Schedule determinism contract:** `generateSchedule({ teams, seasonYear,
  seed })` is byte-identical under identical inputs. Any non-determinism
  (e.g., Math.random slipping in) will fail `invariants.test.ts` exit test 4.
- **The Sprint 7 PRD cap amendment (exit test 2: 32 → 40)** is enforced in
  `tests/integration/schedule/invariants.test.ts`. Preserve the 40 cap until
  the PRD is formally updated.
```

### PRD corrections
- **§5 Sprint 7 exit test 2:** change `28 and 32` → `28 and 40` to reconcile
  with exit test 1's strict double round-robin requirement. This is a
  one-line edit pending a future PRD sweep.

---

## Notes

Test count progression: S1 26 → S2 83 → S3 119 → S4 156 → S5 189 → S6 211 →
S7 **239**. E2E count: 1 → 2 → 3 (smoke + matchDemo + preloadBridge).

Scheduler output on the 360-team seeded league:
- Conference matches: ~5,400 (double round-robin across 31 conferences).
- Non-conference matches: ~200.
- Tournament-flagged: ~30 (teams with 2+ weekend-1 matches).
- Total: ~5,600 Match rows per generation.
- Generation + persist: ~2 seconds.
- Byte-identical regeneration under fixed seed: verified.

This was the **cleanest sprint since Sprint 4**. The things that worked:

1. Arithmetic PRD review at planning time.
2. Per-algorithm unit tests landing before integration.
3. CLAUDE.md gotchas genuinely referenced and applied (mostly — Issue 2
   shows the pattern can still recur even with the document present).

The thing that nearly went wrong but didn't:
- The non-conf greedy algorithm could have landed outside the match-count
  bounds for edge-case conferences (Ivy 8-team with 14 conf matches needs
  14–26 non-conf). It didn't — the constraint system worked first try.
  But it's fragile; a future sprint adding more conferences or changing
  counts could break the bounds without anyone noticing until
  `invariants.test.ts` catches it.
