# Sprint 26 Spec — v1.0 ship + UX polish

**Window:** weeks 51–52 (final sprint)
**Status:** Spec authored 2026-05-02, post-Sprint-25-fix-pass
**Augments:** PRD §5 Sprint 26 ("v1.0 ship & post-mortem") + the Sprint 25 retro carry-forward + the post-pick UX audits (in-game match play; team-pick + post-pick coach UX)

---

## 1. Sprint goal

Ship v1.0. Close the last UX gaps that make the game look feature-complete but feel unfinished — the "I picked my team, what now?" problem and the "I'm watching a match but can't see the score or call a timeout" problem. Land the v1.0 build, signed and tagged, with a coherent first-run flow.

The sprint has **two layered goals**:

1. **From PRD §5 Sprint 26** — public ship: signed v1.0 build + landing page + post-mortem.
2. **Layered on top** — five UX upgrades that resolve the audit gaps before ship.

If beta-execution P0/P1 issues from Sprint 25 are still open at sprint start, those preempt new work. The sprint must end with **zero open P0** and **the v1.0 installer published**.

---

## 2. Inputs (must already exist)

| Input | Status |
|---|---|
| Signed-when-secrets-present installer pipeline | ✅ Sprint 24 |
| electron-updater + Diagnostics opt-in | ✅ Sprint 24 |
| First-run welcome modal | ✅ Sprint 24 (3 generic slides) |
| `useUserTeamStore` populated on save open (Sprint 21 user-team picker) | ✅ Sprint 21 |
| `useSeasonStore.phase` + `currentWeek` | ✅ Sprint 7 / 8 |
| Match Hub with live PBP ticker + scoreboard | ✅ Sprint 19 |
| Timeout system + coach AI baseline archetype | ✅ Sprint 5 / 19 |
| `Match.timelineJson.timeouts[]` populated | ✅ Sprint 19 |
| `Match.timelineJson.substitutions[]` schema (empty in production) | ✅ Sprint 19 (scaffolded only) |
| Sprint 25 P0/P1 fix-pass landed | ✅ commit `7322e3e` |
| Code-signing cert in repo secrets | ❌ **User must obtain — blocks signed v1.0 ship** |
| Closed-beta P0 = 0, P1 ≤ 3 | ❌ **Beta-execution carry-forward — verify at sprint start** |
| Survey Q1 mean ≥ 8/10 | ❌ **Beta-execution carry-forward — verify at sprint start** |

If any of the three carry-forwards fail at sprint start, the spec adjusts: the UX work below stays in scope (it's lightweight), but ship may slip to v1.0.1 or to a Sprint 27.

---

## 3. Tasks

### Task 26.0 — Sprint 25 hygiene (½ day, day 1)

- Verify Sprint 25 carry-forward state on a fresh clone:
  - `git pull && npm install && npm run check && npm run build` all pass
  - `npm test` passes (806/811 + 2 isolated-pass flakes confirmed)
- Confirm beta carry-forward gates:
  - Open `gh issue list -l severity:P0` — must be empty
  - Open `gh issue list -l severity:P1` — count ≤ 3
  - Aggregate survey results into `docs/release/beta-survey-results-<date>.md`
- If gates pass, proceed. If not: triage + fix until they do, deferring UX work as needed.

**Exit:** all three gates met OR the failing gate is documented with a remediation plan.

---

### Task 26.1 — Match-level set score during replay (Item 2; ~30 min)

**What:** Display the running set tally (e.g., "Sets: 2 — 1") in the Match Hub Scoreboard during replay. Currently only point score (0–25) is visible; sets-won is computed but only shown at match end.

**Why:** Audit Item 2 — "Match play doesn't keep active score." The user can see the rally events but not the macro state of the match they're watching.

**TDD approach:**
1. Unit test on `useMatchHubStore`:
   - After a `set_break` entry with `home > away` is applied, `matchSetHome` increments.
   - Reset clears `matchSetHome` / `matchSetAway` to 0.
2. Component test `tests/unit/MatchHub.test.tsx` (already exists per `app/src/store/`):
   - Render with mocked store state (`matchSetHome=2`, `matchSetAway=1`); assert "Sets: 2 — 1" visible in the Scoreboard.

**Implementation:**
- `app/src/store/useMatchHubStore.ts` — add `matchSetHome` / `matchSetAway` (number), update on `set_break` entries in `applyEntry`, clear in `reset()`.
- `app/src/screens/MatchHub.tsx` — add a "Sets" row above the per-set point row, or render as a header chip near the team names. Use existing `--fs-h2` token.
- Accessibility: include in the existing scoreboard `role="table"` with a `scope="row"` header cell labeled "Sets".

**Acceptance:**
- [ ] During replay, the sets tally is visible and updates as sets complete.
- [ ] At "done" phase, sets tally matches the box score winner.
- [ ] axe-core: zero violations on Match Hub.

**Calibration risk:** None — pure UI display; sim unchanged.

**Effort:** Low (~30 min).

---

### Task 26.2 — User-callable timeout button during paused replay (Item 4; ~2h)

**What:** When the replay is paused, show a "Call timeout (Home / Away)" button pair. Clicking injects a `TIMEOUT` ticker entry at the current playback position, displays the standard timeout banner for 2.5s, decrements the relevant team's remaining timeouts, and continues the replay. The action is **cosmetic only** — match outcomes don't change.

**Why:** Audit Item 4 — "As a coach, you have no input." The PRD models the user as program builder, not in-match coach, so true sim-affecting input is v2 scope. But a paused-replay timeout button gives the user agency without sim-fork complexity, and the timeout system is already wired (Sprint 19). This is the highest-leverage user-input feature for v1.0.

**TDD approach:**
1. Unit test on a new `injectUserTimeout(side: 'home' | 'away')` action in `useMatchHubStore`:
   - From a paused state with `homeTimeoutsRemaining > 0`, calling injects an entry at the current cursor and decrements the counter.
   - Calling when `homeTimeoutsRemaining === 0` is a no-op (returns false).
   - Calling when not paused is a no-op (defensive).
2. Component test: paused state shows the button pair; clicking fires the action; "0/2" timeouts remaining disables the corresponding button.

**Implementation:**
- `app/src/store/useMatchHubStore.ts`:
  - Track `homeTimeoutsRemaining` / `awayTimeoutsRemaining` (init from sim defaults: `TIMEOUTS_PER_SET * setsTotal`); decrement on every `timeout` ticker entry (whether AI- or user-injected).
  - Add `injectUserTimeout(side)` action: validate paused + remaining; build a synthetic `TickerEntry` (kind `timeout`, team `side`, score from current scoreHome/scoreAway, source `'user'`); insert at cursor position in the replay scheduler's queue; trigger banner.
- `app/src/screens/MatchHub.tsx`: add a "Call timeout" button pair to the replay-controls row, visible only when `phase === 'paused'`. Disable each button when its team is out of timeouts.
- `shared/src/sim/timeline.ts`: add an optional `source: 'ai' | 'user'` discriminator on `TimeoutEvent` (default `'ai'`). Persisted timeline keeps ai-only; user-injected lives in replay state only.

**Acceptance:**
- [ ] Pause replay → button visible; click → banner appears, count decrements, replay resumes on next `play()`.
- [ ] Out-of-timeouts → button disabled with tooltip "No timeouts remaining."
- [ ] User-injected timeouts appear in the ticker but do not persist to `Match.timelineJson` (cosmetic, replay-only).
- [ ] Existing `mergeTimeline` behavior unchanged for AI timeouts.
- [ ] axe-core: button has accessible name; keyboard navigable.

**Calibration risk:** None — sim and persisted timeline shape unchanged.

**Effort:** Medium (~2 h).

---

### Task 26.3 — Match Hub guard for empty-schedule state (Item 1, partial; ~30 min)

**What:** Match Hub's default landing currently confuses new users. As a stop-gap before Task 26.5 ships the Season Hub, add a banner when `currentWeek === 0` AND no schedule exists: "No matches yet. Generate the season schedule to get started. [Generate]". Clicking calls the existing schedule-generation IPC.

**Why:** Audit Item 1 — "you can't tell what your next actions are." Even with the Season Hub coming (Task 26.5), the Match Hub is reachable from the nav bar throughout the game; new users will land there expecting context. The guard is cheap insurance.

**TDD approach:**
1. Component test on `MatchHub.tsx`:
   - Rendered with `useSeasonStore.currentWeek === 0` and an empty schedule list → banner visible with "Generate" CTA.
   - With a populated schedule → banner hidden.

**Implementation:**
- `app/src/screens/MatchHub.tsx`: add a top-of-screen banner conditional on `useSeasonStore.currentWeek === 0 && useScheduleStore.matches.length === 0`. The "Generate" button calls the existing schedule-generation action; on success, the banner dismisses.

**Acceptance:**
- [ ] Fresh save (preseason, no schedule) → banner appears in Match Hub with working "Generate" CTA.
- [ ] After generate → banner gone.
- [ ] Mid-season save → banner not shown.

**Calibration risk:** None.

**Effort:** Low (~30 min).

---

### Task 26.4 — "Season Rhythm" playbook modal (Item 3; ~1.5 h)

**What:** A one-screen modal mounted after FirstRunModal closes (or on first open of a save where it hasn't been seen). Diagram + prose explaining the 5-phase season loop: PRESEASON → REGULAR → CONF_TOURNEY → NCAA → OFFSEASON → next year. Persisted dismiss via `useSettingsStore.hasSeenPlaybook`.

**Why:** Audit Item 3 — the dynasty rhythm is the central gameplay loop but is invisible in the UI. Testers had to be told via `docs/release/beta-onboarding.md` what to do; v1.0 should tell users in-app.

**TDD approach:**
1. Unit test on `useSettingsStore`:
   - `hasSeenPlaybook` defaults to `false`; `setHasSeenPlaybook(true)` persists to localStorage; reload preserves.
2. Component test on `<PlaybookModal>`:
   - With `hasSeenPlaybook === false`, modal renders.
   - "Got it" button dismisses + sets the flag.
   - Modal does not re-appear on next render.
3. axe-core: modal is keyboard-trappable, `role="dialog"`, has `aria-labelledby`.

**Implementation:**
- `app/src/components/PlaybookModal.tsx` (new): self-contained modal component. Content is the 5-phase diagram (see Appendix A below). Uses existing modal/dialog patterns from `FirstRunModal.tsx`.
- `app/src/store/useSettingsStore.ts`: add `hasSeenPlaybook: boolean` + `setHasSeenPlaybook(v)`; localStorage key `vcd.settings.hasSeenPlaybook`.
- `app/src/main.tsx`: in the Root wrapper, render `<PlaybookModal>` after `<FirstRunModal>` dismisses, gated on `hasSeenPlaybook === false`.

**Acceptance:**
- [ ] First-run flow: FirstRunModal → PlaybookModal → main app.
- [ ] Returning user with `hasSeenPlaybook === true`: skips modal, lands on main app.
- [ ] Manual "Show playbook again" link in Settings (bonus, ~5 min): clears the flag for testing.
- [ ] axe-core: zero violations.

**Calibration risk:** None.

**Effort:** Small (~1.5 h with diagram + tests).

---

### Task 26.5 — Season Hub dashboard (Item 1, primary; ~3–4 h)

**What:** A new screen that becomes the **default landing** post-team-pick. Composes existing stores into a single coach-facing dashboard:

- Header: user team name + logo + record (W–L) + conference rank
- Phase chip: e.g., "Week 3 · REGULAR" or "Signing Day · OFFSEASON"
- Next matchup card: "vs Duke · Fri 9/15 · Home" with "Sim now" CTA
- Recruiting card: "Board: 12 prospects · 3 hot · Signing day in 4 weeks"
- Action grid (large CTAs):
  - **Advance Week** (primary, prominent)
  - Recruiting Board → routes to recruiting screen
  - Schedule → routes to schedule screen
  - Roster / Staff → routes to staff screen
  - Bracket (visible only in CT/NCAA phases)
- Recent results (last 3 matches with scores, links to Match Hub replay)

**Why:** Audit Item 1 — the highest-leverage UX fix. Replaces "land in debug screen → confused" with "land on dashboard → see your team's state → click an action." Pure composition of existing stores; no new IPC, no new domain logic.

**TDD approach:**
1. Component test mounts SeasonHub with mocked stores covering each phase:
   - PRESEASON, no schedule → "Generate Schedule" prominent CTA, no next matchup.
   - REGULAR, week 3 → next matchup card populated, recent results visible.
   - CONF_TOURNEY → bracket card visible, recruiting still shown.
   - NCAA → bracket card prominent, recruiting closed message.
   - OFFSEASON → "View Awards" + "Advance to Year N+1" CTAs.
2. Snapshot test for layout stability (Recharts/visx if used).
3. axe-core: zero violations across all phases.

**Implementation:**
- `app/src/screens/SeasonHub.tsx` (new): pure composition. Reads from `useUserTeamStore`, `useSeasonStore`, `useScheduleStore`, `useRecruitingStore`, `useStandingsStore` (or computes from existing data). No new IPC.
- `app/src/store/useNavStore.ts`: add `'season-hub'` to `ActiveScreen` union; default screen changes to `'season-hub'`.
- `app/src/App.tsx`: add Season Hub to the `TABS` nav (label "Hub"); make it the first tab.
- `app/src/screens/HelloCoach.tsx` (existing): if it overlaps with this dashboard, deprecate or fold its content in. Audit during execution.

**Acceptance:**
- [ ] Fresh save → user picks team → lands on Season Hub showing PRESEASON state.
- [ ] Each season phase renders an appropriate card layout (no broken/missing cards).
- [ ] All action cards route correctly to existing screens (Recruiting, Schedule, etc.).
- [ ] axe-core: zero violations.
- [ ] Performance: renders in < 100 ms on a mid-season save (no IPC waterfall).

**Calibration risk:** None.

**Save-compat risk:** Low — `useUserTeamStore` is hydrated post-Sprint-21; legacy saves with `Season.userTeamId === null` should fall through to a "Pick your team" CTA (re-uses the Sprint 21 TeamPickerModal). Add this fallback as part of the task.

**IPC contracts:** None (pure renderer composition).

**Effort:** Medium (~3–4 h with tests + a11y + edge cases).

---

### Task 26.6 — Substitution UI scaffold (Item 6; ~2 h)

**What:** When the replay is paused, surface a "Lineup" sidebar showing the 6 on-court slots (P1..P6) mapped to player names, plus a bench list (read from current roster minus on-court starters). Add a "Swap" affordance per slot with a dropdown of bench candidates; clicking inserts a `SUB` ticker entry at the current cursor and updates the slot label going forward in the replay. **Cosmetic only — does not re-run the sim.**

**Why:** Audit Item 6 — `substitutionLedger` (Sprint 4) and `Match.timelineJson.substitutions` (Sprint 19) are scaffolded but never populated. v1.0 ships with the schema dormant; sub UI gives users a tactical-feeling surface without sim-fork complexity (which is v2 work).

**TDD approach:**
1. Unit test on `injectUserSub(slotIndex, incomingPlayerId)` action in `useMatchHubStore`:
   - Updates `lineupSlots[slotIndex]` for subsequent ticker entries.
   - Pushes a synthetic `SUB` entry into the replay queue.
   - Records the sub in a transient `userSubs[]` array (replay-only; not persisted).
2. Component test: paused state shows the lineup sidebar; selecting a sub fires the action; banner appears.

**Implementation:**
- `app/src/screens/MatchHub.tsx`: add a "Lineup" panel to the paused-replay view (toggle-able to keep the screen uncluttered for users who don't want it).
- `app/src/store/useMatchHubStore.ts`:
  - Track `userSubs[]` (replay-only).
  - Add `injectUserSub(slot, playerId)` action — same shape as `injectUserTimeout` (Task 26.2).
  - Update slot→playerName resolution in the ticker prettifier so post-sub events show the new player's name.
- Visual: disable the affordance for the libero slot (libero subs follow special rules, out of v1 scope).

**Acceptance:**
- [ ] Pause → lineup panel visible; selecting a swap → SUB banner + ticker entry → playback resumes with new slot label.
- [ ] User subs persist across pause/resume cycles within the same match playback.
- [ ] Closing the match clears `userSubs[]` (cosmetic only — no DB write).
- [ ] axe-core: panel is keyboard-navigable, all swap controls labeled.

**Calibration risk:** None — sim and persisted timeline unchanged.

**Save-compat risk:** None — replay-only state.

**Effort:** Medium (~2 h).

---

### Task 26.7 — v1.0 ship (PRD §5 Sprint 26 deliverables)

**What:** The PRD-stated ship work, executed last:

- Tag and build a signed `v1.0.0` installer.
- Verify on a fresh Win 11 VM via `docs/release/win11-vm-checklist.md`.
- Publish to itch.io (or chosen distribution: direct download via GitHub Releases is acceptable).
- Land the **landing page**: screenshots, feature list, system requirements, link to download. Repo: `docs/release/landing-page/` or a separate static-site repo. Decide at sprint start.
- Update root `README.md` with installation instructions, save-file location, bug-report link.
- Author the **post-mortem doc** at `docs/release/v1.0-post-mortem.md`: what shipped, what slipped (Task 25.2 TeamSeasonSummary; substitution sim re-run; multi-archetype coach AI; Hall of Fame), what to do differently for v1.1.
- Populate the **v2 backlog** in GitHub Issues with prioritized labels: men's volleyball, beach, D-II, multiplayer, Hall of Fame, conference realignment.

**Acceptance (PRD §5 Sprint 26 exit tests):**
- [ ] Public download link is live and verified from a clean Win 11 VM.
- [ ] User can complete the full loop on v1.0: install → create save → play a season → win awards → exit cleanly.
- [ ] v2 backlog exists with prioritization.

**Calibration risk:** None.

**Effort:** Medium (~1 day).

---

### Task 26.8 — Sprint 26 retro

Author at sprint end (per CLAUDE.md sprint-retro discipline; missed for Sprints 21, 22, 26 if not authored on time). File at `docs/retros/sprint-26-retrospective-<YYYYMMDD-HHmmss>.md`. Standard format.

---

## 4. Execution order

1. **Day 1 morning** — Task 26.0 (hygiene) + verify beta gates open the door for ship.
2. **Day 1 afternoon** — Task 26.1 (set score, 30 min) + Task 26.3 (Match Hub guard, 30 min) — quick wins, build momentum.
3. **Day 2** — Task 26.4 (Playbook modal, 1.5 h) + Task 26.5 (Season Hub, 3–4 h) — the core onboarding fixes.
4. **Day 3 morning** — Task 26.2 (user timeout, 2 h) + Task 26.6 (sub UI scaffold, 2 h) — match-play depth.
5. **Day 3 afternoon → Day 5** — Task 26.7 (ship work) — installer, VM verify, landing page, post-mortem.
6. **Day 5 evening** — Task 26.8 (retro) + tag `v1.0.0`.

If beta-execution issues land mid-sprint, push the UX work later in the sprint and prioritize fixing P0/P1.

---

## 5. Definition of Done (Sprint 26)

PRD-stated:
- [ ] v1.0 build tagged, signed, and published.
- [ ] Public download link verified from a clean Win 11 machine.
- [ ] Full-loop play (install → save → season → awards) works on v1.0 without crashes.
- [ ] v2 backlog populated.

Layered (this spec):
- [ ] Match Hub shows match-level set score during replay.
- [ ] Match Hub paused state offers user-callable timeouts.
- [ ] Match Hub paused state offers a sub-UI sidebar (cosmetic).
- [ ] First-run flow shows FirstRunModal → PlaybookModal → app.
- [ ] Default landing post-pick is the new Season Hub.
- [ ] Match Hub shows a "Generate schedule" guard banner when applicable.

Quality gates:
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` pass on `main`.
- [ ] axe-core zero violations on all modified screens (Match Hub, Season Hub, PlaybookModal).
- [ ] Sprint 26 retro filed before tagging `v1.0.0`.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Code-signing cert not procured by sprint start | Spec assumes cert is available; if not, ship `v1.0.0-rc` unsigned with a documented "signed build coming in v1.0.1." |
| Beta-execution P0 surfaces mid-sprint | Push UX work; fix the P0; ship v1.0 with reduced UX scope (skip Tasks 26.5 / 26.6 if needed). |
| Season Hub layout is more polish than budgeted | Ship a "minimum viable" Season Hub (header + phase chip + Advance Week CTA only); polish in v1.1. The Match Hub guard (Task 26.3) covers the worst-case onboarding gap. |
| User-injected timeouts confuse playback (e.g., bouncing between AI and user calls) | Mark user-injected entries with a small "(coach)" tag in the ticker; in tests, assert the source field flows through. |
| FirstRunModal + PlaybookModal in series feels heavy | Combine into a 4-slide FirstRun (3 existing + 1 playbook diagram) if user testing flags it; defer the standalone modal to a settings link. |

---

## 7. Out of scope (v1.1 / v2 backlog)

- True coach-affecting in-match input (timeout mid-rally re-runs the rest of the match in the worker — sim-fork complexity).
- Multi-archetype coach AI (PRD-aligned but lower priority than ship gates).
- Substitution actually affecting sim outcomes (requires sub-aware rally FSM; calibration regen).
- Challenge calls (NCAA rule modeling).
- Deeper Season Hub features (achievements, milestone tracking, alumni news).
- Live decision logging / coach AI explainer tooltips.
- Sprint 25's `TeamSeasonSummary` aggregation (PRD §3.5 25 MB save bar).

---

## Appendix A — Playbook modal content

Plain-text outline; component author should typeset with existing design tokens (no new fonts). Diagram is optional in v1.0 — a typeset list is acceptable.

```
THE SEASON RHYTHM

Your season cycles through 5 phases. Each one has a clear next action.

  1. PRESEASON  (Week 0)
       Schedule isn't generated yet.
       → Action: Generate Schedule, then Advance Week.

  2. REGULAR    (Weeks 1–13, ~23 matches per team)
       Recruiting board is open. Conference + non-conf opponents.
       → Action: Advance Week. Recruit. Manage portal / NIL.

  3. CONF_TOURNEY (Weeks 14–16)
       Single-elim brackets, seeded by conference record.
       → Action: Advance Week. Watch your seed.

  4. NCAA       (Weeks 17–20)
       64 teams, 4 regions, Final Four. Recruiting closes.
       → Action: Advance Week. Win the natty.

  5. OFFSEASON  (Week 21)
       Seniors graduate. Recruits sign and join your roster.
       Transfer portal opens briefly.
       → Action: View awards. Manage offseason. Advance to Year N+1.

The loop repeats. Most decisions happen on the Hub screen — the dashboard
you'll land on every time you open this save.

[ Got it ]
```

---

## Appendix B — File-change summary

**New:**
- `app/src/screens/SeasonHub.tsx`
- `app/src/components/PlaybookModal.tsx`
- `tests/unit/SeasonHub.test.tsx`
- `tests/unit/PlaybookModal.test.tsx`
- `docs/release/landing-page/` (or external repo per Task 26.7)
- `docs/release/v1.0-post-mortem.md`
- `docs/retros/sprint-26-retrospective-<timestamp>.md`

**Modified:**
- `app/src/screens/MatchHub.tsx` (Tasks 26.1, 26.2, 26.3, 26.6)
- `app/src/store/useMatchHubStore.ts` (Tasks 26.1, 26.2, 26.6)
- `app/src/store/useNavStore.ts` (Task 26.5 — add `'season-hub'`)
- `app/src/store/useSettingsStore.ts` (Task 26.4 — `hasSeenPlaybook`)
- `app/src/App.tsx` (Task 26.5 — TABS update; default screen)
- `app/src/main.tsx` (Task 26.4 — mount PlaybookModal)
- `shared/src/sim/timeline.ts` (Task 26.2 — optional `source` discriminator on TimeoutEvent)
- `tests/unit/MatchHub.test.tsx` (Tasks 26.1, 26.2, 26.3, 26.6)
- `README.md` (Task 26.7)
- `CLAUDE.md` (Task 26.8 — "From Sprint 26" gotchas)

**Migrations:** none (this sprint ships no schema changes).

---

## Appendix C — PRD amendments

These should land as part of Task 26.0 cleanup or in the post-mortem:

- **PRD §3.5** save-file budget — formally amend from 25 MB to 50 MB at 10 seasons for v1.0; queue the `TeamSeasonSummary` aggregation (Sprint 25 P2.1) as the v1.1 path back to 25 MB.
- **PRD §5 Sprint 25** "agent testers" — clarify "human testers" for v1.0; v1.1 may add MCP harness.
- **PRD §5 Sprint 13** recruiting commit-rate — add explicit target ("≥70% per cycle when classSize ≥ 1.5× graduate count"). Sprint 25 closed the underlying bug; add the metric for v1.1 verification.

---

*This spec is the source of truth for Sprint 26 execution. If scope shifts during the sprint, update this file in the same PR rather than letting the doc go stale.*
