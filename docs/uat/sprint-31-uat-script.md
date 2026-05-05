# Sprint 31 / Live Play v1.1 — Manual UAT Script

**Goal:** Complete this entire script in **under 10 minutes real time** with
no fatal bugs. This is the PRD §3.5 implicit gate ("end-to-end live match
real time < 10 min") and the Sprint 31 § 7 exit criterion.

**Prereqs:** Built `main` + `app` packages. Run via `npm run dev` or against
a packaged binary. Fresh user-data dir recommended.

---

## Pre-flight

- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` all green
- [ ] `npm run test:calibration:full` unchanged (snapshot recorded in
      `docs/calibration/tuning-log.md`)
- [ ] Fresh save slot created
- [ ] User team picker landed cleanly; user team set

---

## Live match flow

### Set 1

- [ ] **Match Hub → click "Play (Live)"** on the first scheduled match
- [ ] **Rotation editor auto-opens.** Place 6 starters via dropdowns.
  - Verify front-row cells show "front row" styling (CSS highlight)
  - Verify setter slot shows "SETTER" badge
  - Verify opposite cell shows "↔ OPP" badge
- [ ] Pick **6-2** system → setterSlotsTwo dropdowns appear
- [ ] Pick libero (only L-position players visible)
- [ ] Pick **Defensive** hint
- [ ] **Save rotation** → modal closes; visual rotation tracker appears in scoreboard pane
- [ ] **Click "Next 5"** → 5 rallies play; PBP fills; momentum bars update
- [ ] **Press T** → SkillTalkModal opens
  - Pick **Block** → boost banner appears: "+5% block (~10 pts left)"
  - Verify TOs left shows 1/2
- [ ] **Press S** → SubPicker opens
  - Pick a slot → pick a bench player → Confirm
  - Verify subs used shows 1/15
- [ ] **Click "End of set"** → plays to set end OR pauses on smart trigger
  - If `key_rally` banner fires (set point), use Continue / Call timeout buttons
- [ ] At set end: rotation editor reopens automatically for set 2

### Set 2

- [ ] Switch to **5-1** system + **Aggressive** hint, save
- [ ] Verify rotation tracker reflects new rotation (P1..P6 shifted)
- [ ] Verify TOs reset to 2/2; subs reset to 0/15
- [ ] **Click "End of match"** → smart-pause may stop on opponent timeout/sub
  - When paused on opponent action, banner shows reason
  - Resume by clicking "End of match" again
- [ ] Reach set point → **KeyRallyBanner** fires
  - Verify pulsing border + Set point / Match point copy
  - Verify Continue + Call timeout buttons work
  - Wait 8 seconds → auto-dismisses (calls Continue)

### Pause / Resume mid-match

- [ ] **Click "Close"** on Live Play Hub mid-match
  - Verify QuitMatchDialog opens with three options
  - Click **Pause** → returns to Match Hub
- [ ] On Match Hub, verify **Resume Live banner** appears at the top
  - Banner shows correct teams + score + set number
- [ ] **Quit the app entirely** (Cmd+Q / Alt+F4)
- [ ] Relaunch the app, open the same save
- [ ] Verify Resume Live banner STILL appears (auto-save persisted state)
- [ ] Click **Resume Live** → returns to Live Play Hub mid-match
  - Verify state matches what you left (score, momentum, sub count, etc.)
- [ ] **Click "End of match"** → finishes; final box score persists

### Verify persistence

- [ ] Navigate to user-team match list — completed match shows W/L
- [ ] Click the completed match → opens replay (Sprint 19 path)
- [ ] PBP and box score match what was played live

---

## A11y spot checks

- [ ] Tab through Coaching Strategy pane → every button reachable
- [ ] Esc closes each modal
- [ ] Enter activates focused button
- [ ] T / S / R keyboard shortcuts work without focus on inputs
- [ ] Front-row vs back-row visual distinction in tracker (run
      contrast checker on the cell colors — must be ≥ AA)
- [ ] axe-playwright e2e suite passes:
      `npx playwright test livePlayHubA11y.spec.ts`

---

## Pass criteria

- [ ] All checkboxes above ticked
- [ ] **Total elapsed time: under 10 minutes**
- [ ] No console errors in main process or renderer
- [ ] No PBP, box score, or coachActionsJson serialization errors

If pass: tag `live-play-v1.1-complete` and proceed to release.

If fail: log issues with screenshots in `docs/uat/sprint-31-uat-results.md`.
