# Sprint 26 Retrospective

**Date:** 2026-05-02
**Sprint Goal:** v1.0 ship + 5 UX polish items (post-pick orientation; in-match coach input)
**Status:** Partially complete — UX polish items 26.1, 26.2, 26.4, 26.5, 26.6, 26.8 landed; Tasks 26.3 (Match Hub guard) deleted as obsoleted by Sprint 27 spec; Task 26.7 (v1.0 ship) deferred to Sprint 27 by user direction (Sprint 27 spec extends the runway 2 weeks to address structural gameplay-loop issues before ship).
**Health:** 🟢 Clean — no calibration regen, no schema migrations, no IPC contracts, zero test regressions. 833/836 passing (added 27 tests, all green).

---

## Sprint 26 Health Summary

```
SPRINT 26 HEALTH SUMMARY
════════════════════════════════════════

Tasks Completed:        6 / 8 in original plan
  Task 26.0 — Gate verification (Sprint 25 carry-forward closed)
  Task 26.1 — Match-level set score during replay
  Task 26.2 — User-callable timeout button (paused replay)
  Task 26.4 — Season Rhythm playbook modal
  Task 26.5 — Season Hub dashboard (new default landing)
  Task 26.6 — Substitution UI scaffold
  Task 26.8 — Sprint 26 retro (this file)

Tasks Deleted:          1
  Task 26.3 — Match Hub guard banner (OBSOLETED by Sprint 27 Task 27.1
              auto-schedule generation; user user requested structural
              fixes mid-sprint)

Tasks Deferred:         1
  Task 26.7 — v1.0 ship (DEFERRED to Sprint 27 to ship after the
              structural gameplay-loop fixes land)

Issues Encountered:     2 total
  - Failed Approaches:  0
  - Repeated Attempts:  0
  - Diversions:         1  (mid-sprint pivot to design Sprint 27 spec
                            for structural issues)
  - Unexpected Errors:  1  (OneDrive EBUSY transient on test re-run)
  - PRD Deviations:     0
  - Missing Prereqs:    0
  - Dependency Issues:  0

Overall Sprint Health:  🟢 Clean

Top time sinks:
1. Sprint 27 spec authoring (mid-sprint pivot) — substantial design
   work, but appropriate response to user feedback identifying
   structural issues before ship.
2. Test fixture iteration — `getByText` matched ambient prose vs.
   phase-list labels in PlaybookModal (one-iteration fix).
3. Two-render-in-one-test gotcha in SeasonHub.test.tsx — Testing
   Library mounts both renders into the same body, multiple
   getByTestId matches fail (refactored to one-render-per-it).
```

---

## Issues

### Issue: Mid-sprint pivot to author Sprint 27 spec for structural gameplay-loop issues

**Category:** Diversion / Course Correction

**Sprint Task:** Mid-Sprint-26 user message identifying 5 structural issues during a dev-mode play-through.

**What happened:**
The user played the build during Sprint 26 execution and identified five gameplay-loop concerns:

1. Match Hub plays any team-vs-team (should be locked to user team)
2. No date-aware advance (week granularity is too coarse)
3. User can manually generate / regenerate schedule (should auto-gen at season start)
4. Postseason bracket created at season start (should defer to end of regular season)
5. No conference standings or season-aggregate stats screen

These are structural, not cosmetic. Shipping v1.0 with any of items 1, 3, 4 visible would generate P1 bug reports.

**Attempts made:**
1. Considered folding all 5 into Sprint 26. Rejected — substantial scope creep, especially Item 2 (per-day advance is a schema migration + IPC refactor).
2. Considered shipping v1.0 with the structural issues and addressing in v1.0.1. Rejected — better to ship a coherent v1.0.
3. Authored `docs/sprints/sprint-27-spec.md` capturing all 5 issues + re-sequenced Sprint 26 UX work + v1.0 ship at Sprint 27 end. Sprint 27 effort estimate: ~25–35 hours (per-day advance is the biggest piece at 6–8h).

**Resolution:** Sprint 26 continues with the 5 UX polish items that survive re-sequencing. Sprint 26 Task 26.3 (Match Hub guard) deleted because Sprint 27 Task 27.1 (auto-schedule generation) makes the guard unnecessary. Sprint 26 Task 26.7 (v1.0 ship) deferred to Sprint 27 end. v1.0 ship date slips by 2 weeks.

**Diverted from original plan?** Yes — Sprint 26 plan called for v1.0 ship at sprint end. Now Sprint 27 ships v1.0.

**Impact on sprint:**
- Time cost: Medium (~30 min for the audit-explore agent; ~45 min for spec authoring).
- Code quality: Net positive — Sprint 27 spec is more cohesive than continuing without these fixes.
- Technical debt: None (the deferral is documented and structural debt would have created MORE v1.0.x churn).

**Lesson for future sprints:** Run a dev-mode play-through near the END of the build cycle, not just at v1.0 release prep. Sprint 23/24 tested feature paths in isolation; the cohesive "what does it FEEL like" check happens late and surfaces gameplay-loop gaps that are individually small but collectively load-bearing.

---

### Issue: OneDrive EBUSY transient on test file open

**Category:** Unexpected Error / Tooling

**Sprint Task:** Task 26.1 final test run

**What happened:**
First `npx vitest run tests/unit/MatchHub.test.tsx` after editing the file failed with:

```
Error: EBUSY: resource busy or locked, open
'C:\Users\mpkri\OneDrive - Krieger Analytics\.../tests/unit/MatchHub.test.tsx'
```

The OneDrive sync agent had a hold on the file. Test couldn't load.

**Attempts made:**
1. Re-ran after a brief pause (`sleep 3`). Pass.

**Resolution:** Transient. No code change needed.

**Diverted from original plan?** No.

**Impact on sprint:**
- Time cost: Low (~3 min).

**Lesson for future sprints:** Per CLAUDE.md "From Sprint 19" / "From Sprint 24" patterns, OneDrive on Windows occasionally locks files mid-edit. Retry with a small delay.

---

### Issue: PlaybookModal test fixture matched ambient text

**Category:** Failed Approach (test write)

**Sprint Task:** Task 26.4

**What happened:**
First test draft used `screen.getByText(/NCAA/)` to assert the NCAA phase rendered. The modal body has the prose "NCAA Volleyball Coach Dynasty" (in the intro paragraph) which also matched, producing a multiple-match error.

**Attempts made:**
1. Switch to `getByRole('list', { name: /season phases/i })` and `toHaveTextContent('NCAA')` — scopes the assertion to the phase-list `<ol>`.

**Resolution:** Fixed in one iteration.

**Lesson for future sprints:** When writing component tests for content with substring overlap, scope to the specific subtree (role/region) rather than relying on body-wide queries. Mirrors the Sprint 6 lesson on `getByRole` substring matching.

---

### Issue: Multiple-render-in-one-test failure in SeasonHub tests

**Category:** Failed Approach (test write)

**Sprint Task:** Task 26.5

**What happened:**
Two tests called `render(<SeasonHub />)` twice within the same `it()` block — once with REGULAR phase, once after switching to NCAA / OFFSEASON. Testing Library mounts both into the same body without auto-cleanup, so `getByTestId('action-bracket')` found two matches (one from the second render's reachable tree).

**Attempts made:**
1. Add `cleanup` from Testing Library to `afterEach`.
2. Refactored both tests into separate `it()` blocks (one per phase). Cleaner intent + naturally resets between tests.

**Resolution:** Both fixes applied (defense-in-depth).

**Lesson for future sprints:** Per CLAUDE.md "From Sprint 18" — store + DOM are module-level singletons, reset in `beforeEach`/`afterEach`. Single-render-per-test is the cleanest pattern.

---

## Recommendations for Sprint 27

### Carry-forward items

1. **All 5 structural gameplay-loop issues** (per `docs/sprints/sprint-27-spec.md`):
   - Task 27.1: Auto-generate schedule at offseason→preseason (~1.5 h)
   - Task 27.2: Match Hub locked to user-team matches (~2.5 h)
   - Task 27.3: Postseason bracket creation moves to REGULAR→CT transition (~3 h)
   - Task 27.4: Per-day advance with `Season.currentDate` schema column (~6–8 h, schema + IPC)
   - Task 27.5: Standings + season-aggregate stats screen (~4–5 h, deferrable to v1.1)
2. **Task 26.7 v1.0 ship** — installer, Win 11 VM verify, landing page, README, post-mortem, v2 backlog. Same content as Sprint 26 spec; runs at end of Sprint 27.
3. **Season Hub refactor** — Task 26.5 ships using week-based advance. When Task 27.4 lands, refactor SeasonHub to show `currentDate` and "Advance Day" CTA.
4. **app/.tsbuild/ tracked artifacts** — pre-existing issue; the directory contains compiled `.d.ts` files that should be gitignored. Add `app/.tsbuild/` to `.gitignore` and remove from index. (~5 min cleanup.)

### Technical debt to address

1. **CoachPanel bench list is a stub.** Sprint 26 Task 26.6 ships the sub UI scaffold but the "incoming player id" is generated as `bench-${side}-${i}` because the Match Hub payload doesn't include a real bench. Sprint 27 Task 27.2 (Match Hub locked to user team) opens the door to wiring a real bench from `useUserTeamStore` or a new selector.
2. **PlaybookModal Settings link reset is per-launch.** Clicking "Show playbook again" in Settings clears the localStorage flag, but Root's `playbookDismissed` state persists for the session — so the modal returns on next launch, not immediately. Acceptable for v1.0; v1.1 could lift state to make it instant.
3. **CSS chunk size warning.** Vite emits "chunks > 500 kB" warning on the renderer bundle. Not a v1.0 blocker but worth code-splitting in v1.1.

### CLAUDE.md updates

Add a "From Sprint 26" gotchas block in CLAUDE.md (above "From Sprint 25 fix-pass"):

```markdown
### From Sprint 26
- **Default landing screen is Season Hub, not Match Hub.** Sprint 26
  Task 26.5 changed `useNavStore.screen` default from `'match-hub'` to
  `'season-hub'`. Match Hub remains accessible via the nav. Audit Item
  #1 (post-pick orientation) closed.
- **PlaybookModal mounts AFTER FirstRunModal in `main.tsx`.** Sequence:
  FirstRun → Playbook → app. Both gate on `useSettingsStore` flags
  (`hasCompletedFirstRun` + `hasSeenPlaybook`). Settings has a "Show
  playbook again" link that clears the flag (effective on next launch
  due to Root-level dismissed state).
- **Match-level set tally derived from `setHomeScores`/`setAwayScores`,
  not tracked separately.** Avoids state duplication. Computed in the
  Scoreboard component each render; cheap.
- **`useMatchHubStore.injectUserTimeout(side)` and `injectUserSub(...)`
  are replay-only / cosmetic.** They mutate banner + counters but do
  NOT change `Match.timelineJson` or rerun the sim. v1.0 ships without
  match-affecting coach input by design (PRD §2 — coach is program
  builder, not in-match coach). Sprint 27+ may revisit.
- **CoachPanel's bench list is a v1.0 stub.** Synthesized
  `bench-${side}-${i}` ids; the actual roster bench will land in
  Sprint 27 once Match Hub is locked to user-team matches (Task 27.2).
- **`app/.tsbuild/` is currently tracked in git** but should be
  gitignored — pre-existing Sprint-19-era issue. Sprint 27 cleanup.
- **Sprint 26 Task 26.3 (Match Hub guard banner) was DELETED**, not
  shipped, because Sprint 27 Task 27.1 (auto-schedule generation)
  makes manual generation unreachable from the UI; the guard is
  unnecessary. Don't restore it.
```

### PRD corrections

None proposed in this sprint (Sprint 27 spec captures the structural-fix scope; PRD §3.5 + §5 amendments stay queued there).

---

## What worked

1. **TDD-first per task** — every task wrote tests before/alongside the implementation. 27 new tests; 100% pass rate; zero test debt at sprint end.
2. **Composing existing stores for Season Hub.** Task 26.5 has zero new IPC contracts and zero new DB queries. Pure renderer composition. Validates the CLAUDE.md IPC discipline — when stores are well-shaped, dashboards fall out cheaply.
3. **Mid-sprint pivot decision-making.** Authoring Sprint 27 spec instead of force-fitting structural fixes into Sprint 26 was the right call. Sprint 27 plan is now coherent; v1.0 ships from a less-fragmented base.
4. **Calibration discipline held.** Zero golden fixture regenerations this sprint. Every change cosmetic at the sim layer.

## What didn't (or surprised us)

1. **OneDrive EBUSY** — recurring annoyance, mostly transient.
2. **Multiple-render-in-one-test gotcha** — caught early by failing assertions but is a pattern that would have been good to internalize from Sprint 18 (the auto-cleanup CLAUDE.md note covers this; should re-enable it globally).

---

## Stats

- **Tasks completed:** 6 + 1 retro
- **Tasks deleted:** 1 (26.3 obsoleted)
- **Tasks deferred:** 1 (26.7 to Sprint 27)
- **New files:** `app/src/screens/SeasonHub.tsx`, `app/src/components/PlaybookModal.tsx`, `tests/unit/SeasonHub.test.tsx`, `tests/unit/PlaybookModal.test.tsx`, `docs/sprints/sprint-27-spec.md`
- **Modified files:** `app/src/App.tsx`, `app/src/main.tsx`, `app/src/screens/MatchHub.tsx`, `app/src/screens/SettingsScreen.tsx`, `app/src/store/useMatchHubStore.ts`, `app/src/store/useNavStore.ts`, `app/src/store/useSettingsStore.ts`, `app/src/styles.css`, `tests/unit/MatchHub.test.tsx`
- **Test count:** 806 → 833 passing (3 skipped, 0 failures)
- **Build status:** lint ✅ typecheck ✅ build ✅
- **Calibration regen:** none
- **Schema migrations:** none
- **IPC contracts changed:** none
