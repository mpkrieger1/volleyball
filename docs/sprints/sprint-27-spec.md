# Sprint 27 Spec — Gameplay-loop fixes (pre-ship structural)

**Window:** weeks 53–54 (post-Sprint-26, pre-v1.0-ship — extends the runway by 1 sprint)
**Status:** Spec authored 2026-05-02 in response to user-identified structural issues during dev-mode play-through
**Augments:** PRD §5 Sprint 26 / Sprint 27. Replaces the originally-planned Sprint 26 v1.0 ship target with a Sprint 27 ship target. The Sprint 26 UX polish work (`docs/sprints/sprint-26-spec.md`) remains relevant but Sprint 26 Tasks 26.3 (Match Hub guard) and 26.5 (Season Hub) need adjustments listed below.

---

## 1. Why this sprint exists

A dev-mode play-through surfaced five gameplay-loop structural issues:

1. **Match Hub plays any team-vs-team** — should be locked to user's team only.
2. **No date-aware advance** — week-level granularity is too coarse; user expects day-level "all games on this date sim, your match is the one you watch."
3. **User can manually generate / regenerate the schedule** — should auto-generate at offseason→preseason transition only.
4. **Postseason bracket generates at season start** — should defer until end-of-regular-season.
5. **No conference standings or season-aggregate stats screen** — data exists, no UI.

These are **structural**, not cosmetic. Shipping v1.0 with any of issues 1, 3, 4 visible to users would surface as P1 bugs in survey feedback. They preempt the originally-planned Sprint 26 UX polish.

This spec re-sequences: Sprint 27 fixes the structural issues + ships Sprint 26's UX deliverables that survive the re-sequencing. v1.0 ships at Sprint 27 end.

---

## 2. Sprint goal

Lock down the gameplay loop so the user-experienced rhythm is "season starts → schedule appears automatically → you advance through the season day-by-day → your match is yours, not the league's → standings/stats are visible → postseason materializes when the regular season ends." Then ship v1.0.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 25 + fix-pass | ✅ | commit `7322e3e` |
| Sprint 26 UX work (decide what survives) | Partial | `docs/sprints/sprint-26-spec.md` — see §7 below |
| `Match.date` populated by scheduler (Sprint 7) | ✅ | `main/src/schedule/generateAndPersist.ts` |
| `Season.userTeamId` (Sprint 21 user-team picker) | ✅ | `prisma/schema.prisma` |
| `BracketEntry` table (Sprint 11) | ✅ | postseason bracket persistence |
| `RPISnapshot` table (Sprint 10) | ✅ | weekly RPI capture |
| `shared/src/standings/confStandings.ts` (Sprint 10/11) | ✅ | conference-standings computer (already implemented) |
| `runOffseason` → preseason transition (Sprint 16+) | ✅ | offseason orchestration |
| Code-signing cert + beta gates closed | ✅ | confirmed by user pre-Sprint-26 |

---

## 4. Tasks

### Task 27.1 — Auto-generate schedule at offseason→preseason transition (Issue 3)

**What:** Remove the user-facing "Generate Schedule" button. Auto-generate the schedule once, at the transition from OFFSEASON → PRESEASON (or first PRESEASON open, whichever lands cleanest). Idempotent — a regenerate attempt on an existing season is a no-op.

**Why first:** Unblocks Tasks 27.3 (postseason timing) and 27.4 (per-day advance). Removing user agency over schedule simplifies every downstream concern.

**TDD approach:**
1. Integration test `tests/integration/season/scheduleAutoGen.test.ts`:
   - Fresh save in PRESEASON → no schedule exists → call `enterPreseason()` (or whichever is the canonical transition fn) → assert all conference + non-conference matches exist with dates.
   - Calling twice → second call is no-op (no duplicate matches).
2. Component test on `ScheduleView.tsx`:
   - "Generate Schedule" button no longer rendered.
   - "Subtitle" copy updated from "Generate a 2026 schedule, then pick a team" to "View your schedule."
3. E2E: create save → land on Season Hub → Schedule tab shows the schedule with no Generate button.

**Implementation:**
- `main/src/season/enterPreseason.ts` (new — or extend whichever orchestrates the offseason→preseason transition): add an idempotency guard (`if (await tx.match.count({ where: { seasonYear, isTournament: false }}) > 0) return`), then call `generateAndPersistSchedule({ dbPath, seasonYear, seed })`.
- Wire the new fn into the offseason orchestrator OR into save-slot create (for fresh saves that land in PRESEASON immediately).
- `app/src/screens/ScheduleView.tsx` — delete the "Generate" button + handler; update subtitle.
- `app/src/store/useScheduleStore.ts` — keep `loadMatches()`, remove `generate()` action (or keep it private/unused).
- Save-compat: legacy saves with no schedule and no `Season.dynastyYear` → fall through to auto-gen on first open.

**Acceptance:**
- [ ] Fresh save renders Schedule with the season auto-generated.
- [ ] No "Generate" button anywhere in the UI.
- [ ] Idempotent: a second call is a no-op.
- [ ] Schedule generation deterministic for a given seed (Sprint 7 invariant).

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Small (~1.5 h).

---

### Task 27.2 — Match Hub locked to user's team (Issue 1)

**What:** Match Hub no longer presents both home and away as free dropdowns. Instead: the home team is **fixed to the user's team** for every match the user plays. The user picks WHICH of their team's upcoming or recent matches to view; the away team is whoever the schedule says.

**Why:** As the coach of Team X, the user only plays X's matches. Other teams' matches happen automatically.

**TDD approach:**
1. Component test `tests/unit/MatchHub.test.tsx`:
   - With `useUserTeamStore.userTeamId === 'tA'`, the matchup picker only lists matches involving `tA`.
   - "Play match" button is disabled if no match selected; enabled if a user-team match is selected.
   - Sim arbitrary team-vs-team is no longer reachable.
2. Integration test: load a save mid-season → Match Hub presents the user's next match by default → other matches' results visible read-only in the recent-results card on Season Hub.

**Implementation:**
- `app/src/screens/MatchHub.tsx`:
  - Replace dual-team dropdown with a list of the user team's matches (upcoming + recently played), grouped by date.
  - Each match shows opponent + date + home/away + status (unplayed / played).
  - Click an unplayed match → "Play this match" CTA → routes through existing `simulateAndLoad` with the right team ids.
  - Click a played match → "Replay" CTA → loads the existing PBP / box score.
- `app/src/store/useMatchHubStore.ts`:
  - Add `userTeamMatches: Match[]` populated from `useScheduleStore.matches` filtered to user team.
  - Existing `simulateAndLoad` action keeps its signature (homeId, awayId) — Match Hub callers pass user-team-derived ids.
- The dev-mode "any team vs any team" simulator can move to a debug-only screen behind a `VCD_DEV` env check, or be removed entirely. Decide during execution; default to **remove** (the codebase already has `tests/integration/match/matchPersist.test.ts` for engineer-side validation).

**Acceptance:**
- [ ] Match Hub presents only user-team matches.
- [ ] User can play their next unplayed match.
- [ ] User can replay their previously-played matches.
- [ ] Cannot simulate Alabama vs Ohio State if user is coaching Stanford.
- [ ] axe-core: zero violations.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Small-Medium (~2.5 h).

---

### Task 27.3 — Postseason bracket creation moves to end-of-regular-season (Issue 4)

**What:** `BracketEntry` rows must NOT exist during PRESEASON or REGULAR. They materialize on the REGULAR → CONF_TOURNEY transition (where final RPI is known and conference auto-bids resolve from real conference-tournament results once those finish).

**TDD approach:**
1. Integration test `tests/integration/postseason/bracketTimingInvariant.test.ts`:
   - Through PRESEASON + 13 weeks of REGULAR → assert `BracketEntry.count() === 0` at every step.
   - Advance to first CT round → `BracketEntry.count() === 64`, RPI snapshots final.
2. Existing Sprint 11 tests should still pass; if any depend on early bracket creation, update them deliberately.

**Implementation:**
- Find every call site of `generateAndPersistBracket()` in `main/src/postseason/`. Identify the early call (likely from a `startSeason` or `enterRegular` orchestration).
- Move the call to fire from `enterConferenceTournament()` (or equivalent) — the transition that runs after week 13 wraps.
- Verify the Sprint 11 dual-call pattern still works (early seed-with-stub-auto-bids was the original; Sprint 11 added a real-auto-bid override). Consolidate to a single end-of-RS call.
- Update `BracketView.tsx` to render an empty / "Bracket not yet finalized" state during PRESEASON + REGULAR.

**Acceptance:**
- [ ] `BracketEntry` table empty through entire regular season.
- [ ] Bracket appears at REGULAR → CONF_TOURNEY transition.
- [ ] Bracket reflects FINAL RPI snapshots (not provisional).
- [ ] BracketView shows graceful empty-state pre-regular-season-end.
- [ ] All existing postseason tests pass.

**Calibration risk:** Low — bracket seeding is deterministic given the same RPI input. The Sprint 11 fixtures may need a regen if the RPI snapshot used for seeding is from a different week than before. Verify intentionally per CLAUDE.md §3.
**Schema risk:** None.
**Effort:** Medium (~3 h).

---

### Task 27.4 — Per-day advance (Issue 2)

**What:** Replace `advanceWeek` semantics with `advanceDay` semantics. The user advances one calendar day at a time. All matches with `Match.date` matching the current day sim. The user's team match (if any) is presented for the user to "play" (manually trigger replay); the rest auto-sim in the background.

**Why:** The per-week mental model bundles ~170 matches into a single click — flat, undifferentiated. Per-day advance makes the season feel like a season; the user has a sense of time passing and a sense that their match is special.

**Important constraint:** This is the riskiest task in the sprint. It touches:
- Schema (`Season.currentDate`)
- IPC contracts (`seasonIpc.advanceWeek` → `advanceDay`)
- Most stores (`useSeasonStore`, `useMatchHubStore`, `useScheduleStore`)
- Calibration (golden fixtures may regen if date ordering shifts match results)
- Save-compat (existing saves don't have `currentDate`)

**TDD approach:**
1. Schema migration test:
   - Apply migration to a Sprint-26-shape save → `Season.currentDate` populated to first unplayed match's date.
   - Idempotent on re-apply.
2. Integration test `tests/integration/season/advanceDay.test.ts`:
   - Generate schedule → advance through all dates → all matches played → `Season.phase` advances correctly.
   - Per-day: each call sims only matches matching `currentDate`; subsequent calls bump `currentDate` by 1 day.
   - User-team match on a date: returned as a "playable" entry; non-user matches auto-sim.
3. Calibration test: full-season advance via `advanceDay` produces the same season totals (kills, hitting %, side-out rate, AA selections) as Sprint 25's `runFullSeason` did via `advanceWeek`. Tolerance: exact match if seeds align; if not, document why.

**Implementation:**
- `prisma/schema.prisma`: add `Season.currentDate: DateTime?` (nullable for backward-compat).
- New migration `prisma/migrations/<timestamp>_add_season_currentdate/migration.sql`. Forward-compat backfill: `UPDATE Season SET currentDate = (SELECT MIN(date) FROM Match WHERE seasonYear = Season.year AND winnerId IS NULL)`.
- `main/src/season/advanceDay.ts` (new): mirror of `advanceWeek` but filtering by `Match.date = currentDate`. Bumps `Season.currentDate` by 1 day on completion.
- `main/src/season/advanceWeek.ts`: deprecate as a public IPC. Internally, `advanceWeek` becomes a loop over 7 days for tests / calibration.
- IPC: `seasonIpc.advanceDay` schema added; `advanceWeek` retained for backward-compat but UI no longer calls it.
- `app/src/store/useSeasonStore.ts`: add `currentDate`, `advanceDay()` action.
- `app/src/screens/SeasonHub.tsx` (Sprint 26 work — adjust per §7 below): show current date prominently; "Advance Day" CTA replaces "Advance Week."
- `app/src/screens/MatchHub.tsx`: when there's a user-team match TODAY, present "Play [Today's match]" as the primary CTA.
- `runFullSeason.ts` calibration runner: refactor to drive the day loop.

**Acceptance:**
- [ ] `Season.currentDate` populated at all times during REGULAR.
- [ ] Per-day advance simulates exactly the matches scheduled for that date.
- [ ] User-team match presented for manual play; non-user matches auto-sim.
- [ ] Season-totals invariants from Sprint 22 calibration hold (or differences are documented + golden regen).
- [ ] Save-compat: Sprint 26-shape saves migrate forward without data loss.

**Calibration risk:** **Medium-High.** Date-ordered advance might surface match-result variance vs. week-batched advance because the seed-derivation chain changes (per-day RNG forks vs. per-week). A canonical test case: "compare `runFullSeason` final standings under both advance modes for the same seed." If they diverge by more than RPI rounding, regen calibration goldens deliberately.
**Schema risk:** Forward-compat migration mandatory.
**Effort:** Large (~6–8 h).

---

### Task 27.5 — Standings + season-aggregate stats screen (Issue 5)

**What:** New "Standings" screen with three tabs:
1. **Conference Standings** — per conference, sortable W-L / conf record / RPI / poll rank.
2. **National RPI** — top 25 by RPI with W-L.
3. **Stat Leaders** — individual leaders by category (kills, assists, digs, blocks, aces, hitting %).

**Why:** Data exists (`shared/src/standings/`, `RPISnapshot`, `PlayerMatchStat`); UI doesn't. Users want it; v1.0 should ship with it.

**TDD approach:**
1. Unit test `tests/unit/StandingsView.test.tsx`:
   - Conference Standings tab: loads conference rows, sortable.
   - RPI tab: top 25 by current week's RPI snapshot.
   - Stat Leaders tab: top 20 per category.
2. Integration test `tests/integration/standings/aggregates.test.ts`:
   - Mid-season: standings reflect played matches, stat leaders show real numbers.
3. axe-core: zero violations on all tabs.

**Implementation:**
- `app/src/screens/StandingsView.tsx` (new):
  - Tab nav (Conference / RPI / Stat Leaders).
  - Conference: groups by `Team.conferenceId`, calls existing `confStandings.computeConferenceStandings()`.
  - RPI: queries latest `RPISnapshot.week`, reads top 25.
  - Stat Leaders: aggregates `PlayerMatchStat` per player for the season.
- `app/src/store/useStandingsStore.ts` (new): `loadConferences()`, `loadRpi()`, `loadStatLeaders()`. Hydrated lazily on tab activation.
- New IPC handlers in `main/src/ipc/standingsHandlers.ts` + zod schemas in `shared/src/ipc/standingsMessages.ts`. CLAUDE.md §IPC compliance — strict zod typing.
- `app/src/store/useNavStore.ts`: add `'standings'` to `ActiveScreen` union.
- `app/src/App.tsx`: add Standings tab.

**Acceptance:**
- [ ] Mid-season save: Conference Standings tab shows sortable per-conf table with computed records.
- [ ] RPI tab shows top 25 with current-week RPI.
- [ ] Stat Leaders tab shows top 20 per category for the current season.
- [ ] axe-core: zero violations.

**Calibration risk:** None — pure data-rendering (data is computed elsewhere).
**Schema risk:** None.
**Effort:** Medium (~4–5 h).

---

### Task 27.6 — Sprint 26 UX work, re-sequenced

The Sprint 26 plan included:
- 26.1 Match-level set score
- 26.2 User timeout button
- 26.3 Match Hub guard banner — **OBSOLETE** (Task 27.1 makes auto-gen happen; no manual generate UI to guard)
- 26.4 PlaybookModal
- 26.5 Season Hub dashboard — **MUST INCORPORATE** Task 27.4's date semantics (show `currentDate`, "Advance Day" CTA)
- 26.6 Sub UI scaffold

Recommendation:
- **Drop 26.3 entirely.** Auto-generation removes the gap.
- **Land 26.5 (Season Hub) AFTER 27.4 (per-day advance)** so the Hub renders the right CTA verbiage and date semantics from day one.
- **Keep 26.1 / 26.2 / 26.4 / 26.6 as-is** — they're independent of the structural fixes.
- Add a new sub-task: **Match Hub layout adjustment** to accommodate Task 27.2's user-team-match-list view (see Task 27.2 implementation; the set-score / timeout / sub UI features all still apply).

---

### Task 27.7 — v1.0 ship (moved from Sprint 26)

PRD §5 Sprint 26 deliverables, executed at the end of Sprint 27 instead. Same content as the Sprint 26 spec Task 26.7. No changes to the work itself; the timing slips by 2 weeks.

---

### Task 27.8 — Sprint 27 retro

Standard retro per CLAUDE.md sprint-retro discipline. File at `docs/retros/sprint-27-retrospective-<YYYYMMDD-HHmmss>.md`. Authored BEFORE tagging `v1.0.0`.

---

## 5. Execution order

Day-by-day plan assuming a 2-week sprint:

**Week 1 (structural fixes):**
- **Day 1:** Task 27.1 (auto-gen schedule) — unblocks the rest.
- **Day 2:** Task 27.3 (postseason timing). Task 27.2 (Match Hub user-team lock) in parallel if a second session is available; otherwise serial.
- **Day 3–4:** Task 27.4 (per-day advance) — the largest single piece.
- **Day 5:** Task 27.5 (Standings screen).

**Week 2 (UX polish + ship):**
- **Day 6:** Sprint 26 surviving tasks: 26.1 (set score), 26.2 (user timeout), 26.4 (PlaybookModal).
- **Day 7:** Sprint 26 task 26.5 (Season Hub) — uses 27.4's `currentDate` semantics.
- **Day 8:** Sprint 26 task 26.6 (sub UI scaffold).
- **Day 9:** Task 27.7 (ship work — installer, VM verify, landing page, post-mortem).
- **Day 10:** Task 27.8 (retro) → tag `v1.0.0` → publish.

Buffer: ~1 day. If Task 27.4 calibration regen takes longer, drop Task 27.5 to v1.1 (Standings is the single most-deferrable item; it's a feature, not a fix).

---

## 6. Definition of Done

PRD §5 Sprint 26/27 (v1.0 ship):
- [ ] v1.0 build tagged, signed, and published.
- [ ] Public download link verified from clean Win 11 VM.
- [ ] Full-loop play works on v1.0.
- [ ] v2 backlog populated.

Structural fixes (this sprint):
- [ ] Schedule auto-generates at offseason→preseason; user never sees a "Generate" button.
- [ ] Match Hub locked to user team's matches.
- [ ] Postseason bracket materializes only at REGULAR → CONF_TOURNEY transition.
- [ ] Per-day advance is the user-facing cadence; week-batched advance available for tests / calibration.
- [ ] Standings screen with Conference / RPI / Stat Leaders tabs.

Sprint 26 UX polish (re-sequenced):
- [ ] Match-level set score during replay.
- [ ] User-callable timeout in paused replay.
- [ ] PlaybookModal in first-run flow.
- [ ] Season Hub as default landing (with date-aware semantics from Task 27.4).
- [ ] Sub UI scaffold in paused replay.

Quality gates:
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build && npm run build:installer:signed` all pass.
- [ ] axe-core: zero violations on Match Hub, Season Hub, Standings, PlaybookModal.
- [ ] Sprint 27 retro filed BEFORE tagging `v1.0.0`.
- [ ] Calibration goldens regenerated intentionally if Task 27.4 produces legitimate divergence.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Per-day advance calibration regen takes longer than budgeted | If Task 27.4 calibration drifts, document the divergence and regen goldens in a dedicated commit per CLAUDE.md §3. Worst-case fallback: defer Task 27.4 to v1.1 and ship v1.0 with week-advance UI labeled "Advance Week" — accept the per-week granularity as v1.0 final. |
| Schema migration on Sprint 26 saves | Task 27.4's `Season.currentDate` is nullable + backfilled; the Sprint 25 `applyMigrations` path (P0.5 fix) handles forward-compat automatically. |
| Sprint 26 Season Hub depends on 27.4 semantics | Land 27.4 first, then 26.5. Don't start 26.5 in parallel. |
| User-team match list in Match Hub doesn't exist for fresh saves (no schedule yet) | Task 27.1 ensures schedule auto-generates on first save open; Task 27.2 always has a user-team match list to show. |
| Bracket regen affects Sprint 11 tests | Task 27.3's move may shift which RPI snapshot is used for seeding. Update Sprint 11 fixtures intentionally per CLAUDE.md §3. |
| Standings IPC contracts add to v1.0 surface area | Task 27.5 IPC contracts are net-new but tightly scoped; document in CLAUDE.md "From Sprint 27." |
| Cert/secrets drift before ship | Same Sprint 26 risk; verify cert state on the build day. |

---

## 8. Out of scope (v1.1 backlog)

- Multi-archetype coach AI (deferred from Sprint 26)
- True match-affecting subs (sim re-run on pause + sub)
- `TeamSeasonSummary` aggregation (PRD §3.5 25 MB save bar)
- i18n / localization
- Hall of Fame, all-time leaderboards
- Conference realignment, men's, beach, D-II, multiplayer

---

## 9. Open questions for the maintainer

1. **Should Issue 5 (Standings) ship in Sprint 27 or v1.1?** Recommendation: ship in Sprint 27 if Task 27.4 lands cleanly; defer to v1.1 if calibration regen consumes the runway.
2. **Should `advanceWeek` be removed entirely from the public IPC after Sprint 27?** Recommendation: deprecate but retain for one sprint of backward-compat; remove in v1.1.
3. **Should the user be able to "skip ahead" to the next user-team match instead of advancing day-by-day?** Recommendation: v1.1 polish — add a "Skip to next match" CTA on Season Hub. Out of scope for Sprint 27.
4. **Match Hub debug mode for engineers?** Recommendation: remove the all-team picker entirely (lean on `tests/integration/match/matchPersist.test.ts` for engineer-side validation). If needed later, gate behind `VCD_DEV` env check.

---

## 10. Why this is a separate sprint vs. folded into Sprint 26

Sprint 26's plan was lean (5 UX items + ship). The structural issues identified here are individually larger (especially Task 27.4) and have schema/IPC implications Sprint 26 didn't budget for. Trying to fold these in would:
- Push Sprint 26 from ~1.5 weeks to ~3 weeks.
- Risk a half-built per-day-advance landing in v1.0.
- Mix UX polish with structural refactor in a single set of commits, making bisect / rollback harder.

Better: Sprint 26 is now an UNFINISHED sprint that gets folded into Sprint 27 cleanly, with v1.0 shipping at Sprint 27 end. Total runway extension: 2 weeks. Worth it for a coherent v1.0.

---

*Spec is the source of truth for Sprint 27 execution. If scope shifts during the sprint, update this file in the same PR.*
