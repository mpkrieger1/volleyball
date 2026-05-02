# Sprint 14 Retrospective (Reconstructed)

**Reconstructed:** 2026-05-01 from CLAUDE.md gotchas + Sprint 15's lessons-applied references + git tags. The original retro file was never written and has been flagged as missing across multiple sprints (S15 → S24 retros). This reconstruction is best-effort and is **not a substitute** for the contemporaneous notes that should have been captured at the time.

**Sprint Goal (PRD §5):** Transfer portal — entry, browsing, contacting, signing.
**Status:** Complete — all 3 PRD S14 exit tests passed on first Monte Carlo run.
**Health (estimated):** 🟢 Clean

---

## Reconstructed health summary

```
Tasks Completed:        ~9 (Recruit→Portal entry; PortalEntry table;
                            portal AI; portal commit resolution; UI
                            view; tests)
Issues Encountered:     ~4 (estimated from CLAUDE.md gotchas)
  - Failed Approaches:  1  (export * as ... silently failing post-Edit)
  - Diversions:         0
  - Unexpected Errors:  1  (relation filter on mutated state)
  - PRD Deviations:     0
  - Missing Prereqs:    0

Overall Sprint Health:  🟢 Clean. PRD exit tests passed first try thanks
to threshold-prototyping discipline carried over from the Sprint 13 retro.
```

---

## Issues (reconstructed from CLAUDE.md "From Sprint 14")

### Issue: `export * as` silently failing post-Edit

**Category:** Failed Approach / Tooling

**What happened:**
After editing `shared/src/index.ts` to add a new namespace re-export
(`export * as portal from './portal';`), the Edit tool reported success
but the exported namespace did not appear in the built file. Took 2
typecheck iterations to surface.

**Resolution:** After any edit to the shared index, grep for the new
namespace name in the source file before running typecheck.

**Lesson:** Edit-tool "success" is not proof of file mutation when the
target string already partially matched something else. Verify after
editing barrel files.

---

### Issue: Prisma relation filters on mutated row state

**Category:** Unexpected Error

**What happened:**
A query like `recruit: { commitState: 'PENDING' }` (relation filter)
stopped returning rows mid-loop after the loop body had updated some
recruits' state. Prisma's nested relation filter appeared to miss
newly-written rows in rapid back-to-back calls.

**Resolution:** Pre-compute a Set of pending IDs once per loop iteration
and filter via `recruitId IN (...)` instead.

**Lesson:** For any filter that depends on a row state that changes
during a loop, pull the id list first. (This same lesson was reapplied
in Sprint 15's NIL signing pipeline and Sprint 17's coaching role
queries.)

---

### Issue: Test-fixture random IDs (carried forward from Sprint 13)

**Category:** Lint / Determinism

**What happened:**
Two test fixtures used `Math.random()` for random identifier
generation. Sprint 1's determinism ESLint rule blocked them.

**Resolution:** `crypto.randomUUID().slice(0, 7)` for any random test
fixture identifier. Added to the running list of "Math.random reflexes
caught by lint."

**Lesson:** Default to `crypto.randomUUID()` for any random identifier
in test fixtures. (Sprint 15 was the first sprint where this reflex
fired correctly on first-draft code.)

---

## Recommendations (reconstructed)

### Carry-forward to Sprint 15+

1. Cross-cutting entities seed at save-slot creation via
   `seedLeagueInto`. Sprint 14 added Player rows to the seed (4,320
   rows; +5–10s save-slot creation). Sprint 15 should add Boosters via
   the same pattern. **(Applied in Sprint 15.)**
2. Batched `$transaction([...])` array form for bulk independent writes.
   Interactive `$transaction(async tx => ...)` partially commits at
   ~3,600 sequential updates. **(Applied across Sprints 15-17.)**
3. Validate statistical thresholds with a prototype simulation before
   committing to a numeric bar in tests. (Sprint 13's "top-5 ≥ 3.5
   stars" was unachievable; Sprint 14 verified portal entry-rate
   target before writing the integration test.) **(Applied throughout.)**

### Technical debt opened

- None reported in CLAUDE.md.

---

## CLAUDE.md gotchas added in Sprint 14

(See CLAUDE.md "From Sprint 14" block for the canonical content.)

- `export * as` re-exports must be grep-verified post-edit.
- Cross-cutting entities seed at save-slot create.
- Sprint 14's Monte Carlo passed all 3 PRD exit tests on first run; the
  pattern is "validate thresholds first, implement second."
- Prisma relation filters on mutated rows — use `id IN (...)` instead.

---

## Reconstruction notes

What this reconstruction **does not** capture:

- Specific commit SHAs / dates from Sprint 14's window (~ 2026-06-01 to
  2026-06-15 per CLAUDE.md timestamps; the project repo at
  `https://github.com/mpkrieger1/volleyball.git` was only initialized
  in Sprint 24, so Sprints 1–23 history exists only in retros and
  CLAUDE.md).
- Per-task timing or exact issue counts.
- Anything about scope changes mid-sprint.

If the original retro materials exist in chat history, replace this
reconstruction with the original.
