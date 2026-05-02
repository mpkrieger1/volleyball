# Sprint 21 Retrospective

**Date:** 2026-05-01 (backfilled in Sprint 24 Task 24.0; Sprint 21 retro was
not authored when the sprint ended)
**Sprint Goal:** Polish pass — accessibility (axe-clean across all screens),
font-size scaling, useTableState shared sort/filter/multi-select hook,
post-Save-create user-team picker.
**Status:** Complete
**Health:** 🟡 Bumpy (one notable mid-sprint issue)

---

## Summary

Sprint 21 was the polish sprint: every user-facing screen had to pass
axe-core with zero violations, the app needed scalable typography for
small/medium/large readers, and the recruiting/portal/NIL screens needed
consistent sort + filter + multi-select keyboard ergonomics. The sprint
also added the user-team picker that fires after Save-create.

The major hiccup mid-sprint: I tried to ship the sprint after only 2 of
11 planned tasks were complete. The user caught it (`Don't you need to
complete the other tasks in this sprint?`) and I reset and finished all
11 tasks.

---

## Sprint 21 Health Summary

```
Tasks Completed:        11 / 11 (after correction)
Issues Encountered:     ~3
Overall Sprint Health:  🟡 Bumpy
```

---

## Issues

### Issue: Premature sprint-end (only 2 of 11 tasks complete)

**Category:** Failed Approach / Process

**What happened:** I declared Sprint 21 done after completing 2 tasks
(font scaling + useTableState skeleton). User pushed back: "Don't you
need to complete the other tasks in this sprint?"

**Resolution:** Reset; completed all 11 tasks (axe sweep, FontSizePicker,
RecruitingBoard sort/filter, PortalView sort/filter, NilView sort/filter,
TeamPickerModal post-Save-create, useUserTeamStore + load on slot open,
RecruitingBoard/PortalView/NilView migration to useUserTeamStore with
teams[0] fallback, axe-playwright e2e harness, accessible color
contrast pass on the main app palette).

**Lesson for future sprints:** Trust the plan's task count. When the
plan says "11 tasks", the sprint isn't done at task 2. Track all tasks
in TaskCreate and only declare done when every task is `completed`.

---

### Issue: Vitest sub-path alias too greedy

**Category:** Unexpected Error

**What happened:** Sprint 19's hotfix added a plain-string alias
`'@vcd/shared/seed' → shared/src/seed/leagueSeed`. This greedy
prefix-matched `@vcd/shared/seed/leagueSeed` in Sprint 13/15/17 seed
unit tests and produced a wrong path. 4 seed tests failed with
module-resolution errors.

**Resolution:** Switched both `app/vite.config.ts` and `vitest.config.ts`
to regex aliases anchored with `$`, ordered most-specific first:

```ts
alias: [
  { find: /^@vcd\/shared\/seed$/, replacement: ...src/seed/leagueSeed },
  { find: /^@vcd\/shared(\/.*)?$/, replacement: ...src + '$1' },
]
```

**Lesson for future sprints:** Whenever a new `@vcd/shared/<sub>` sub-path
is added, anchor with `$` and order most-specific first. Captured in
CLAUDE.md "From Sprint 21".

---

### Issue: `role="button"` on `<tr>` breaks accessible name

**Category:** Unexpected Error

**What happened:** Initial RecruitingBoard accordion expanded rows used
`<tr role="button">`. Override of `role="row"` made the accessible name
the concatenation of all `<td>` text; tests like
`getByRole('button', { name: 'Player p1' })` failed; axe flagged the
ARIA composition violation.

**Resolution:** Move the button inside a single `<td>`. Use
`aria-controls`/`aria-expanded` for inline expander relationships.

**Lesson for future sprints:** Never put `role="button"` on a `<tr>` —
the implicit `role="row"` is load-bearing. Captured in CLAUDE.md
"From Sprint 18" already; Sprint 21 hit it again on a different
component.

---

## Recommendations for Sprint 22

1. **Carry-forward**: nothing material; sprint shipped clean after the
   correction.
2. **Pattern**: `useTableState` is the canonical sort/filter/multi-select
   pattern across recruiting/portal/NIL screens; reuse for any new
   tabular screen.
3. **Pattern**: `axe-playwright` is the live-Electron a11y tool; e2e tests
   should `injectAxe(window) + checkA11y` for any new screen.
4. **CLAUDE.md additions**: regex-anchored sub-path aliases, useTableState
   convention, font-size CSS custom properties, axe-playwright pattern,
   user-team picker post-Save-create flow. (All landed in CLAUDE.md
   "From Sprint 21" block.)

---

*Backfilled 2026-05-01 from conversation context and the existing CLAUDE.md
"From Sprint 21" block.*
