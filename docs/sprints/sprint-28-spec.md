# Sprint 28 Spec — Roster, Recruiting Redesign & Schedule Restructure

**Window:** weeks 55–56 (post-Sprint-27 ship; v1.0 already in users' hands or imminent — this is v1.1 scope)
**Status:** Spec authored 2026-05-02 from user-driven UX requests
**Augments:** PRD §5 — extends Sprint 7 schedule rules, Sprint 13 recruiting UX, Sprint 14 player generation timing, Sprint 18 staff lifecycle.
**Personal-use note:** This is a personal/non-commercial project (confirmed by Matt 2026-05-02). FCCD's recruiting screens may be referenced freely as a design source for layout, copy, info hierarchy, and interaction model. CLAUDE.md §1 will be amended in Task 28.7 to reflect this.

---

## 1. Why this sprint exists

Five user-identified gaps from post-v1.0 dynasty play:

1. **No roster screen for the user's team.** Player rows exist; nothing surfaces them in one place.
2. **No player profile.** Clicking a player should open their full card (ratings, stats, bio, recruiting class, dev curve).
3. **Recruits + coaches generate at save-creation, not at Week 1.** Wrong rhythm — the fresh-save UX shows a fully-populated recruiting board before the season has even started.
4. **Coaching staff doesn't churn in the offseason.** Coaches age but no retirements / poaching / open-slot fills happen.
5. **Recruiting screen feels sparse vs. the FCCD model the user wants.** Want to mirror FCCD's screens, logic, inputs.
6. **Schedule structure is wrong.** Want exactly 10 non-con games (weeks 1–N) followed by 18 conference games (weeks N+1–13), with smaller conferences playing fewer conf games.

---

## 2. Sprint goal

Deliver the manager-side UX the user expects: see your roster, click any player to inspect them, watch recruits + coaches arrive in Week 1 and turn over in the offseason, work the recruiting board against an FCCD-grade screen, and play a season whose calendar matches a real D-I structure (non-con block → conference block).

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 27 ship + structural fixes | ✅ assumed | `docs/sprints/sprint-27-spec.md` |
| `Season.userTeamId` (Sprint 21) | ✅ | `prisma/schema.prisma` |
| `Team.confId` populated for all teams (Sprint 7) | ✅ | seed data |
| `RecruitingBoard` table + `useTableState` hook (Sprint 21) | ✅ | `app/src/hooks/useTableState.ts` |
| Coach generation in `seedLeagueInto` (Sprint 13) | ✅ | `shared/src/seed/leagueSeed.ts` |
| Recruit generation in `seedLeagueInto` (Sprint 14) | ✅ | same file |
| `PlayerMatchStat` write path (Sprint 18) | ✅ | `pickStartersForTeam` |
| `runOffseason` orchestrator (Sprint 16+) | ✅ | `main/src/offseason/runOffseason.ts` |
| `generateAndPersistSchedule` (Sprint 7, partial-rewrite expected) | ✅ | `main/src/schedule/generateAndPersist.ts` |
| FCCD install for design reference | ✅ | `C:\Program Files (x86)\Steam\steamapps\common\Football Coach College Dynasty` |

---

## 4. Tasks

### Task 28.1 — Roster screen for user's team (Issue 1)

**What:** New `RosterView.tsx` screen, accessible from main nav (after Schedule, before Recruiting). Lists every player on the user's team in a sortable, keyboard-navigable table. Default sort: position (S, OH, MB, OPP, L), then OVR desc.

**TDD approach:**
1. Component test `tests/unit/RosterView.test.tsx`:
   - Mounts with `useUserTeamStore.userTeamId === 'tA'`.
   - Renders rows for every Player where `teamId === 'tA'`.
   - Sort by OVR desc / asc / cleared (cycles via `useTableState`).
   - Click row fires `onPlayerSelect(playerId)` (verifies wiring for Task 28.2).
   - axe-clean.
2. E2E `tests/e2e/rosterView.spec.ts`: open save → click Roster nav → see rows → keyboard-tab through table → Enter on a row triggers profile open (covered in 28.2).

**Implementation:**
- `app/src/screens/RosterView.tsx` — table columns: jersey, name, pos, year (FR/SO/JR/SR/RS-FR/etc), height, OVR, POT, status (HEALTHY / INJURED / REDSHIRT). Use `useTableState` for sort + selection (Sprint 21 pattern).
- `app/src/store/useRosterStore.ts` — Zustand store with `players: Player[]`, `load(teamId)`, reset.
- `main/src/ipc/rosterHandlers.ts` — IPC handler `roster.listForTeam(teamId)` returns Player rows + ratings + status. Reuse existing `Player` type from `@vcd/shared`.
- Nav wiring in `app/src/screens/SeasonHub.tsx` (or wherever main nav lives — Sprint 27 likely refactored this).

**Acceptance:**
- [ ] Roster screen accessible from main nav.
- [ ] Shows all players on user's team (typically 12–18 rows).
- [ ] Sortable by every column; keyboard-navigable.
- [ ] axe-core zero violations.
- [ ] Performance: opens in <100 ms for a 18-player roster.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Small (~2 h).

---

### Task 28.2 — Player profile modal (Issue 2)

**What:** Click any roster row → `PlayerProfileModal.tsx` opens. Shows the full player card: bio (name, height, hometown, year, jersey), ratings block (all sub-skills, OVR, POT), season stats from `PlayerMatchStat` aggregated, career stats if multi-season, redshirt status, recruiting class info (stars, ranking when signed, hometown school). Read-only this sprint.

**Reference:** FCCD's player-profile screen — sections, info density, expand/collapse pattern. Mirror the layout where it makes sense for volleyball; replace football-specific stats (carries, INTs) with volleyball ones (kills, errors, total attacks, hitting %, digs, blocks, aces).

**TDD approach:**
1. Component test `tests/unit/PlayerProfileModal.test.tsx`:
   - Mounts with a fixture player + season-stats fixture.
   - Renders bio, ratings, season-stats sections.
   - ESC closes (focus restored to trigger row).
   - axe-clean (axe checks tabbable focus trap + accessible name).
2. Integration: open Roster → click row → modal opens → player data matches DB.

**Implementation:**
- `app/src/components/PlayerProfileModal.tsx` — uses existing modal primitives (Sprint 26 patterns). Sections collapsible.
- `main/src/ipc/playerHandlers.ts` — extend or add `player.getProfile(playerId)` returning `{ player, ratings, currentSeasonStats, careerStats, recruitingMeta }`. Stats come from `PlayerMatchStat` aggregated per season.
- Stats aggregation lives in `shared/src/stats/playerAggregate.ts` (new) — pure function, unit-tested. Hitting % follows the volume-weighted formula from CLAUDE.md "From Sprint 22" (`(Σkills − Σerrors) / ΣtotalAttacks`).
- Modal positioned to not obscure the row; ESC + click-outside both close.

**Acceptance:**
- [ ] Click a roster row → profile opens with all fields populated.
- [ ] Stats reconcile to box-score totals across the player's matches this season (cross-validation invariant — see Sprint 20 pattern).
- [ ] ESC closes; focus returns to trigger row.
- [ ] axe-core zero violations.

**Calibration risk:** None.
**Schema risk:** None.
**Effort:** Medium (~3.5 h).

---

### Task 28.3 — Recruits + coaches generated in Week 1, not save-slot creation (Issue 3)

**What:** Move recruit + coach generation out of `seedLeagueInto` and into a Week-1-of-PRESEASON hook (or first regular-season tick — pick whichever frames better). Save-slot creation seeds Teams + Players only. Recruits and coaches arrive when the season starts.

**Why this matters:** A fresh save in PRESEASON should show empty recruiting board and team coach slots. The "scouting period opens" beat is part of the season-start UX rhythm.

**Caveat:** Sprint 27 may have moved schedule generation to the offseason→preseason transition. Recruit/coach generation should fire at the *same* transition for consistency. Verify before implementation.

**TDD approach:**
1. Integration test `tests/integration/season/week1Generation.test.ts`:
   - Fresh save in PRESEASON → `recruit.count() === 0`, `coach.count() === 0`.
   - Advance to Week 1 (or trigger preseason→regular transition) → `recruit.count() ~= EXPECTED_RECRUIT_POOL_SIZE`, `coach.count() ~= teams * COACH_SLOTS_PER_TEAM`.
   - Idempotent: calling the hook twice does not double-generate.
2. Update existing fixture-based unit tests in Sprints 12–17 that depend on coaches/recruits at save-creation time. Most likely fix: their `beforeEach` should explicitly trigger the Week-1 hook OR use a `seedTestRecruitsAndCoaches` helper similar to Sprint 23's `topupRostersForTest`.

**Implementation:**
- Extract the recruit+coach generation logic from `shared/src/seed/leagueSeed.ts` into a new module `shared/src/preseason/initEntities.ts`. Keep the same deterministic-by-seed contract.
- `seedLeagueInto` no longer calls these.
- `main/src/season/enterPreseason.ts` (Sprint 27) calls `initEntities` after the schedule is generated. Idempotency guard: skip if `recruit.count(seasonYear=current) > 0`.
- Save-slot creation gets faster (CLAUDE.md "From Sprint 14" notes Player generation added 5–10 s — not removed here, but verify total time doesn't regress).

**Acceptance:**
- [ ] Fresh save in PRESEASON has 0 recruits + 0 coaches.
- [ ] After preseason→regular transition: full recruit pool + full coach roster.
- [ ] Idempotent.
- [ ] Generation deterministic by seed (Sprint 14 invariant).
- [ ] All existing tests pass (with `topup`-style helpers added where needed).

**Calibration risk:** Low. Recruit-pool-size and coach-roster-size totals must match what `seedLeagueInto` previously produced; Monte Carlo distributions unchanged.
**Schema risk:** None.
**Effort:** Medium-Large (~4 h, dominated by test-fixture migration).

---

### Task 28.4 — Coaching staff offseason refresh (Issue 4)

**What:** `runOffseason` adds a coach-lifecycle phase. Each offseason:
- **Age** all coaches (+1 year).
- **Retirements:** coaches over an age threshold (e.g., 65+) retire with a probability that increases with age. Empty slots created.
- **Poaching:** AI teams hire from a pool of free agents + steal from lower-prestige rivals (deterministic by seed).
- **Open-slot fills:** any remaining empty HC/AC slot fills from the free-agent pool. CLAUDE.md §Critical rules #4 invariant: "Every team has an HC slot filled at every tick" — so HC fills are mandatory and must be backfilled in the same offseason transaction.
- **Contract progression:** existing coaches' contract years tick down; expiring contracts trigger a renewal probability check.

**Reference:** FCCD's coaching carousel + offseason coach screens for UX. Extract the user-facing flow (notifications of coach changes on user's team, prompt-to-hire when user has an opening). Replace football-specific roles (OC, DC, ST coordinator) with volleyball roles (HC, AHC, AC, recruiting coordinator — finalize role list in §6 design doc).

**TDD approach:**
1. Unit tests `tests/unit/coachLifecycle.test.ts`:
   - Retirement probability monotonic in age.
   - Free-agent pool replenishes (some retirees re-enter as advisors? — design call).
   - Determinism per seed.
2. Integration test `tests/integration/offseason/coachChurn.test.ts`:
   - Run `runOffseason` for 5 simulated seasons.
   - Assert: total HC count remains == team count at every tick (invariant).
   - Assert: coach roster turnover ≥ X% per season (some churn, not zero).
   - Assert: no team has 2 HCs simultaneously (Sprint 17 multi-coach query lesson — filter by role, but ensure 1 HC).

**Implementation:**
- New module `main/src/offseason/coachLifecycle.ts`. Pure-ish functions for `ageAllCoaches`, `processRetirements`, `runHiringMarket`, `fillOpenSlots`, `progressContracts`.
- All called inside `runOffseason`'s existing `$transaction` (CLAUDE.md "From Sprint 18" invariant — same tx as NCAA_CHAMP → OFFSEASON).
- Use **array-form** `$transaction` for the bulk updates (CLAUDE.md "From Sprint 13" — never wrap 1000+ updates in interactive `$transaction`).
- For Player-style cascading deletes if a retired coach has FK dependents, follow CLAUDE.md "From Sprint 25" cascade pattern.

**Acceptance:**
- [ ] HC slot filled for every team at every tick across 5 simulated seasons.
- [ ] Coach turnover > 0 per offseason (~5–15% baseline; tuneable).
- [ ] Determinism: same seed → same coach moves.
- [ ] User-team coach changes generate Notification rows (existing notification system from earlier sprint).
- [ ] Performance: coach-lifecycle phase < 2 s per offseason.

**Calibration risk:** Medium. Retirement / poaching probabilities are new tuning knobs. Add to `shared/src/coaching/tuning.ts`. Run a 10-season Monte Carlo at sprint end to verify churn rate sits in target band.
**Schema risk:** Low. May need `Coach.retirementYear` (nullable) and `Coach.contractYearsRemaining` if not already present. Migration follows the sprint-aligned timestamp convention (CLAUDE.md "From Sprint 19").
**Effort:** Large (~6 h).

---

### Task 28.5 — Recruiting screen redesign (FCCD-modeled) (Issue 5)

**What:** Rewrite `RecruitingBoard.tsx` to mirror FCCD's recruiting screen structure. Specific FCCD elements to replicate (per user request — personal-use project):

- **Recruit list pane** with sortable columns: name, pos, stars, region/state, current leader, interest level, GPA/HS-school if available.
- **Recruit detail pane** (right side or modal): pitch/sales options, scouting status, weekly action picker (visit / call / scholarship / scout), interest meter showing all teams competing for this recruit, projected commit window.
- **Weekly action budget** UI: visual indicator of points-spent / points-available, mirroring FCCD's points/hours allocation widget.
- **Team needs panel**: positions where the user's roster is thin, suggesting recruit-target priorities.
- **Commit / decline events** surface as notifications during weekly advance.

**Approach (clean-room-leaning but reference-permitted, per personal-use note):**
1. **Phase A — design doc.** Read FCCD's recruiting screens. Capture the layout, info hierarchy, action affordances, copy patterns into `docs/design/recruiting-redesign-v2.md`. Include screenshots / sketches / annotated descriptions. **User reviews this before code starts.**
2. **Phase B — implementation.** Rebuild `RecruitingBoard.tsx` against the design. Reuse Sprint 21 `useTableState` for sort/selection. New sub-components: `RecruitDetailPane.tsx`, `WeeklyActionBudget.tsx`, `TeamNeedsCard.tsx`, `InterestMeter.tsx`.

**TDD approach:**
- Component tests for each new sub-component (axe + interaction).
- Integration: end-to-end recruiting cycle (open cycle → spend weekly actions → advance → see interest move → recruit commits).

**Implementation:**
- Most weekly-action mechanics already exist in Sprint 13 — verify before reimplementing. The visible work is mostly UI restructure + adding the team-needs computation.
- `main/src/ipc/recruitingHandlers.ts` extends with a `recruiting.teamNeeds(teamId)` IPC computing position thinness from current roster.
- The design doc is the contract; code review compares the diff against the doc, not against FCCD source.

**Acceptance:**
- [ ] Design doc reviewed + approved by user before Phase B starts.
- [ ] All FCCD-modeled screen elements present and functional.
- [ ] Weekly action budget enforced (cannot over-spend).
- [ ] Team needs panel reflects real roster gaps.
- [ ] Existing recruiting integration tests still pass (cycle open → advance → commit).
- [ ] axe-core zero violations.

**Calibration risk:** None — recruiting math unchanged; only UI restructured.
**Schema risk:** None unless `teamNeeds` requires a new derived column (probably not — compute on read).
**Effort:** Large (~8 h: 2 h design, 6 h implementation).

---

### Task 28.6 — Schedule restructure: 10 non-con + up-to-18 conf, non-con first (Issue 6)

**What:** Rewrite the schedule generator. New rules:

- **Non-conference block:** weeks 1–N. Every team plays exactly **10** non-con games. Non-con opponents drawn deterministically from outside the team's conference, balanced for travel/region (existing Sprint 7 region helper).
- **Conference block:** weeks N+1–13. Conference games per team = **min(18, (confSize − 1) × 2)**.
  - 10+ team confs: 18 conf games. Some opponents played 2×, others 3× (fill order: rematch closest geographic neighbors first; tiebreak by `(seasonYear, seed)` jitter for determinism).
  - <10 team confs: `(confSize − 1) × 2` conf games — simple double round-robin.
- **No mixing:** every team's first 10 games are non-con; all subsequent games are conf. The transition week is fixed across all teams to keep the standings page coherent.

**Total games per team:** 10 + (conf count). Most teams play 28; small-conf teams play fewer.

**Invariant changes (must update CLAUDE.md §Critical rules #4):**
- ❌ Remove: "Every team in a conference plays every other member exactly twice per regular season."
- ✅ Add: "Every team plays exactly 10 non-conference games in weeks 1–N (non-con block); subsequent weeks are conference-only."
- ✅ Add: "Conference game count per team = min(18, (confSize − 1) × 2); confs of size ≥10 may have some pairs play 3× and others 2×."
- ✅ Keep: "No team scheduled for two matches on the same date."

**Update Sprint 7 PRD exit test 1.** Old: strict double round-robin. New: the rules above.

**TDD approach:**
1. Unit tests for the conference-pairing function (`shared/src/schedule/confPairings.ts` new): given a conf of size N, returns a list of (teamA, teamB, gameCount) pairs with the right total per team. Deterministic by seed.
2. Integration test `tests/integration/schedule/restructured.test.ts`:
   - Generate schedule for a season with mixed conf sizes (8, 10, 12, 16).
   - Assert: each team has exactly 10 non-con games, all in weeks 1–N.
   - Assert: each team's conf-game count = min(18, (confSize − 1) × 2).
   - Assert: every conf game is a true intra-conf pairing (both teams' `confId` matches).
   - Assert: no two matches for one team on same date.
   - Assert: deterministic by seed.
3. Update existing scheduler invariant tests (`tests/integration/schedule/invariants.test.ts`) — replace double-round-robin assertion with the new invariants.
4. Calibration: re-run the full-season calibration suite (`npm run test:calibration:full`). Standings + RPI distributions may shift slightly because match volume changed for small-conf teams.

**Implementation:**
- `shared/src/schedule/confPairings.ts` (new) — pure function, deterministic.
- `shared/src/schedule/nonConferenceMatchups.ts` — refactor existing non-con generator to produce exactly 10 per team within the first N weeks.
- `main/src/schedule/generateAndPersist.ts` — orchestrates: phase 1 generates non-con block, phase 2 generates conf block, all matches written in one transaction.
- `app/src/screens/ScheduleView.tsx` — group display by "Non-conference" / "Conference" headers. Highlight the transition week.

**Acceptance:**
- [ ] Schedule generation passes all new invariants for confs of size 8, 9, 10, 12, 14, 16.
- [ ] Non-con games strictly precede conf games for every team.
- [ ] Calibration suite still within tolerance (any drift documented in `docs/calibration/tuning-log.md`).
- [ ] Existing Sprint 7 invariant tests updated; old double-round-robin assertion removed deliberately with explanation in commit.
- [ ] PRD §5 Sprint 7 exit test 1 updated in same PR.
- [ ] CLAUDE.md §Critical rules #4 updated in same PR.

**Calibration risk:** Medium-High. Match volume changes for small-conf teams (fewer conf games means fewer total games means fewer at-bats for stat aggregation). Top-25 calibration metric (Sprint 22) likely fine because top 25 teams are in big confs. But verify.
**Schema risk:** None — `Match` table already supports both block types via `tournamentRound: null`.
**Effort:** Large (~6 h).

---

### Task 28.7 — CLAUDE.md + PRD updates (housekeeping)

**What:** Companion edits required by Tasks 28.3, 28.6, and the personal-use clarification.

**Edits:**
1. **CLAUDE.md §Critical rules #1** — add personal-use note: "VCD is a personal/non-commercial project; FCCD may be referenced freely as design source. Do not redistribute FCCD assets even so."
2. **CLAUDE.md §Critical rules #4** — replace the double-round-robin invariant with the three new schedule invariants from Task 28.6.
3. **PRD §5 Sprint 7 exit test 1** — replace strict double-round-robin language with: "Each team plays exactly 10 non-con games (weeks 1–N) followed by min(18, (confSize − 1) × 2) conference games (weeks N+1–13). Determinism per seed."
4. **CLAUDE.md "Gotchas accumulated"** — add Sprint 28 entries after the sprint completes (deferred to retro).

**Acceptance:**
- [ ] All three docs updated in the same PR as the task they support.
- [ ] No silent invariant change anywhere in code (every relaxed invariant has a corresponding doc update).

**Effort:** Small (~30 min, mostly during other tasks).

---

## 5. Order of execution

Recommended sequence (dependencies):

1. **28.7** (CLAUDE.md personal-use note first — unblocks 28.5 design phase).
2. **28.5 Phase A** (design doc — unblocks user review while you work on other tasks; longest critical-path item).
3. **28.6** (schedule restructure — pure-function-heavy, easy to TDD, no UI dependencies).
4. **28.3** (week-1 generation — touches the same preseason transition that 28.6 lands schedule into).
5. **28.4** (coach lifecycle — depends on 28.3 having coach generation working at the right moment).
6. **28.1** (roster screen).
7. **28.2** (player profile — depends on 28.1's roster nav).
8. **28.5 Phase B** (recruiting UI rewrite — once design doc approved).

Tasks 28.1 and 28.2 are tight together; could be done as a pair after 28.4 lands.

---

## 6. Performance budget watch

Per CLAUDE.md §5:

| Surface | Budget | Sprint 28 risk |
|---|---|---|
| Single match sim < 150 ms | unchanged | ✅ no change |
| Full week (~170 matches) < 8 s | unchanged | ✅ no change |
| Regular-season advance < 2 min | unchanged | ⚠️ schedule restructure may shift week distribution; re-verify |
| Save file < 25 MB after 10 seasons | currently 35 MB target (Sprint 23 note) | ✅ no change |
| Save-slot creation | informal — currently includes coach+recruit gen | ✅ **faster** after 28.3 (~3–5 s reduction) |
| Preseason→regular transition | new — must complete in <3 s | ⚠️ new gate, set during 28.3 |
| Offseason | currently <30 s (assumed) | ⚠️ 28.4 adds coach lifecycle; <2 s budget for that phase |

Run `npm run bench` before sprint close.

---

## 7. Exit criteria

Sprint 28 is done when:

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` passes.
- [ ] `npm run test:calibration:full` passes (or drift documented + accepted).
- [ ] PRD updates landed in same PR as Task 28.6.
- [ ] CLAUDE.md updates landed in same PR as Task 28.7.
- [ ] Recruiting redesign doc reviewed + signed off by user before Task 28.5 Phase B started.
- [ ] Sprint 28 retro authored at `docs/retros/sprint-28-retrospective-{date}.md`.
- [ ] Tagged `sprint-28-complete`.

---

## 8. Out of scope (defer to v1.2+)

- Transfer portal UX (recruiting board only — portal is its own screen, Sprint 21 ships it; not touched here).
- NIL deal screen overhaul (Sprint 21 NilView remains as-is).
- Multi-coach interview / firing UX (lifecycle is automated this sprint; manual user agency in v1.2).
- Conference realignment (PRD §2 — out of scope for v1.x).
- Schedule customization by user (deterministic-only this sprint).
