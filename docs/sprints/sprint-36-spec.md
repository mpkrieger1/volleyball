# Sprint 36 Spec — Pitch Reasons + NIL + Recruiter Quality + UI

**Window:** weeks 71–72 (post-Sprint-35; v1.2 recruiting batch finale)
**Status:** Spec authored 2026-05-04 from FCCD-parity scope review (B-picks). Second of two sprints (35/36) overhauling recruiting to mirror Football Coach: College Dynasty.
**Augments:** Sprint 18 (AVCA Awards), Sprint 33 (offseason calendar), Sprint 35 (priority-driven interest model).
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists

Sprint 35 ports FCCD's priority-driven interest model — recruits actively compare schools on attributes they care about. But the user's weekly experience is still mechanical: click `PHONE_CALL`, click `HOME_VISIT`, watch a points bar tick up. FCCD adds three layers on top of the math:

- **Pitch reasons** — coach narrative bonuses ("Coach Smith has won 2 national championships" / "Coach Jones is from your hometown of San Diego"). Up to +75 points per recruit, gated by per-recruit "active/inactive" flags so different recruits respond to different pitches.
- **NIL** — money. The user has a team budget, earmarks $X for a recruit, and that converts to interest points via the `NilDeal` priority weight.
- **Recruiter Quality** — coaches aren't all equal. An "Ace" recruiter contributes 2× the points of a "Mediocre" one.

Sprint 36 ports each of those three (in slim form per the scope review) and surfaces them in `RecruitDetailModal`.

---

## 2. Sprint goal

After Sprint 36:

- Each team has a `nilBudgetCents` annual pool, refreshed at SIGNING_DAY.
- Each `RecruitInterest` row has a `nilOfferCents` field the user can adjust.
- Two pitch reasons fire per (team, recruit): `CoachPedigree` (national + conference championships) and `CoachConnection` (HC/AHC/AC hometownState vs recruit hometownState).
- `Coach.recruiterQuality` is a derived enum (`'ACE' | 'GREAT' | 'GOOD' | 'MEDIOCRE'`) computed from `ratingRecruit`. Multiplier table `[2.0, 1.66, 1.33, 1.0]` is applied to the coach's contribution in `computeRecruitTeamInterest`.
- `RecruitDetailModal` shows: interest meter (top-5 competing teams with bars), priorities readout, pitch-reasons panel (active/inactive cards with flavor text), scout tier indicator, NIL slider.
- AI teams allocate NIL via a simple heuristic (top-5 board recruits get the budget proportional to interest; trailing teams over-allocate to one big-fish target).

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 35 priority model + new columns | ⚠️ Sprint 35 dependency | Sprint 35 spec |
| `Coach.hometownState` (Sprint 35) | ⚠️ Sprint 35 dependency | Sprint 35 spec |
| `Award` rows (national + conference championships) | ✅ Sprint 18 | `prisma/schema.prisma` |
| `Match.tournamentRound` history | ✅ | `prisma/schema.prisma` |
| `Coach.ratingRecruit` | ✅ | `prisma/schema.prisma:140` |
| `Recruit.hometownState` | ✅ | `prisma/schema.prisma:202` |
| `RecruitDetailModal.tsx` | ✅ | `app/src/components/RecruitDetailModal.tsx` |
| Last migration: `20261214_000000_recruiting_core` (Sprint 35) | ⚠️ | `prisma/migrations/` |

---

## 4. Tasks

### Task 36.1 — Schema migration: NIL fields

**What:** Two columns. Migration timestamp `20261228_000000_recruiting_nil`.

**Schema additions:**

```prisma
model Team {
  // ...existing fields...
  nilBudgetCents      Int @default(0)  // refreshed at SIGNING_DAY each cycle
  nilBudgetUsedCents  Int @default(0)  // running total spent this cycle
}

model RecruitInterest {
  // ...existing fields...
  nilOfferCents  Int @default(0)
}
```

`nilBudgetCents` is seeded from prestige tier at fresh save and at each `SIGNING_DAY` event:

```
budget = prestigeTier × $50,000 ($30k floor, $300k ceiling)
```

**TDD approach:**
1. `tests/integration/migrations/recruitingNilMigration.test.ts`:
   - Apply on a fresh DB; assert columns exist with correct defaults.
   - Apply on a legacy DB; assert backfill seeds `nilBudgetCents` based on team prestige (idempotent).
2. `tests/integration/seed/nilBudgetSeed.test.ts`:
   - Fresh league: spot-check 5 teams have prestige-appropriate budgets.

**Implementation:**
1. `prisma/migrations/20261228_000000_recruiting_nil/migration.sql`.
2. `prisma/schema.prisma` — additions above.
3. `shared/src/seed/leagueSeed.ts` — write `nilBudgetCents` per team at seed.
4. `main/src/saveSlots/backfillNilBudget.ts` — post-migration backfill keyed on the migration name.
5. `main/src/offseason/events/signingDay.ts` (Sprint 33 stub) — at SIGNING_DAY end, refresh `nilBudgetCents` and reset `nilBudgetUsedCents` for next cycle.

**Acceptance:**
- [ ] Migration applies cleanly on fresh + legacy DBs.
- [ ] Budget refreshes at SIGNING_DAY.

**Calibration risk:** Low.
**Schema risk:** Low — two columns on existing tables.
**Effort:** Small (~1.5 h).

---

### Task 36.2 — Pure helper: pitch reasons

**What:** One function, two reason types. Port-adapted from FCCD module 69979 (`getRecruitingEffortBonusPoints`).

```ts
export type PitchReasonType = 'COACH_PEDIGREE' | 'COACH_CONNECTION';

export interface PitchReasonResult {
  type: PitchReasonType;
  active: boolean;       // does THIS recruit care?
  points: number;        // 0..50 per reason
  flavorText: string;    // for the UI tooltip
}

export const MAX_TOTAL_PITCH_BONUS = 75;

export function computePitchReasons(args: {
  team: Team;
  coaches: Coach[];          // HC + AHC + AC (or whatever staff is hired)
  recruit: Recruit;
  awardsHistory: { coachId: string; type: 'NATIONAL_CHAMP' | 'CONF_CHAMP'; year: number }[];
}): {
  reasons: PitchReasonResult[];
  totalActivePoints: number;  // sum of active reason points, capped at 75
};
```

**CoachPedigree:**
- Inputs: HC's career title count from `awardsHistory`.
- Points: `min(30, 10 × nationalChamps) + min(25, 5 × confChamps)`.
- Active per recruit: `WantsToWin` personality flag (deterministic per recruit.id, ~30% of recruits) → always active. Otherwise active for ≥4★ recruits at 30% chance, ≤3★ at 50% chance (FCCD logic).
- Flavor text: "Coach Smith has won 1 national championship and 3 conference championships."

**CoachConnection:**
- Inputs: HC, AHC, AC `hometownState` vs recruit's `hometownState`.
- Points (port of FCCD zipcode-tier table, adapted to states):
  - Same state: +20
  - Adjacent state (use existing `region` mapping — same region counts as adjacent): +10
  - Otherwise: 0
  - Best of HC/AHC/AC.
- Active per recruit: deterministic 75% chance for high-school recruits; 100% for transfers (when v1.3 lands).
- Flavor text: "AHC Jones is from California, the same state as recruit Smith." or "None of the staff has a connection to recruit's home state of Ohio."

The two reasons are summed and capped at `MAX_TOTAL_PITCH_BONUS = 75`. The cap matches FCCD's constant exactly.

The pitch-reasons total is added to interest BEFORE the rubberband multiplier, mirroring module 11671's `Math.round(p * (l.pointsToAdd + g.total))` flow.

**TDD approach:**
1. `tests/unit/recruiting/pitchReasons.test.ts`:
   - HC with 2 national + 5 conference titles → CoachPedigree = `min(30, 20) + min(25, 25) = 45`.
   - HC + AHC + AC all from CA, recruit from TX → CoachConnection = 0 (different state, different region).
   - HC from CA, recruit from CA → +20.
   - HC from NY, recruit from CT (same EAST region) → +10.
   - Total active points capped at 75.
   - Determinism: same (team, recruit) → same active flags.

**Implementation:**
1. `shared/src/recruiting/pitchReasons.ts` (new).
2. Re-export via `@vcd/shared/recruiting`.
3. Add a state-adjacency helper (or reuse existing region grouping from `@vcd/shared/seed/teamRegions`).
4. Wire into `computeRecruitTeamInterest` (Sprint 35) — pitch reasons total feeds the bonus add-in.

**Acceptance:**
- [ ] Both reasons compute correctly per the spec.
- [ ] Active flags are deterministic per recruit.
- [ ] 75-point cap enforced.

**Calibration risk:** **Medium**. Adding 0–75 bonus points to interest can shift league-wide commit distributions. Verify with the 5-season simulation.
**Schema risk:** None.
**Effort:** Medium (~3 h — two reason types + state-adjacency mapping).

---

### Task 36.3 — Pure helper: NIL conversion

**What:** Convert dollar offer to interest points. Port-adapted from FCCD module 64485.

```ts
export function getNilOfferBaselineCents(recruit: Recruit): number;
// stars 5 → $250k baseline; 4 → $100k; 3 → $40k; 2 → $15k; 1 → $5k

export function convertNilOfferToPoints(args: {
  offerCents: number;          // user/AI bid this much
  recruit: Recruit;
  priorities: RecruitPriorities;  // need .nilDeal weight from Sprint 35
}): number;                    // 0..~150 interest points
```

**Formula:**
```
priorityWeight = max(1, priorities.nilDeal)   // default 1 if recruit doesn't care
baseline       = getNilOfferBaselineCents(recruit)
ratio          = offerCents / baseline
points         = round(75 × priorityWeight × ratio)   // FCCD constant 75
```

A 5★ recruit with `nilDeal=8` priority who gets a $250k offer (1.0× baseline) earns `75 × 8 × 1.0 = 600 → cap at MAX_NIL_POINTS = 200` (we cap below FCCD's untyped result to keep NIL from dominating). A 5★ with `nilDeal=2` who gets the same offer earns `75 × 2 × 1.0 = 150` — same money, less impact.

**TDD approach:**
1. `tests/unit/recruiting/nilOffer.test.ts`:
   - Baseline values per star tier.
   - Linear scaling in offer amount.
   - 5★ with `nilDeal=10` and a $0 offer earns 0.
   - Cap at 200.

**Implementation:**
1. `shared/src/recruiting/nilOffer.ts` (new).
2. Re-export via `@vcd/shared/recruiting`.
3. Wire into `computeRecruitTeamInterest` (Sprint 35) as a separate add-in (pitch reasons + NIL combined cap = MAX_BONUS_POINTS = 150 → final per-recruit interest `clamp(rawInterest + pitchTotal + nilPoints, 0, 100)`).
4. Update `Team.nilBudgetUsedCents` whenever a user/AI commits NIL via `RecruitInterest.nilOfferCents`.

**Acceptance:**
- [ ] Conversion behaves as specced.
- [ ] Budget-used tracking is correct.
- [ ] Total bonus cap (pitch + NIL) enforced.

**Calibration risk:** **Medium-High**. NIL is the single largest knob added this sprint.
**Effort:** Medium (~2.5 h).

---

### Task 36.4 — Recruiter Quality tier helper

**What:** Pure derivation, no schema.

```ts
export type RecruiterQuality = 'ACE' | 'GREAT' | 'GOOD' | 'MEDIOCRE';

export function getRecruiterQuality(coachRatingRecruit: number): RecruiterQuality {
  if (coachRatingRecruit >= 85) return 'ACE';
  if (coachRatingRecruit >= 70) return 'GREAT';
  if (coachRatingRecruit >= 55) return 'GOOD';
  return 'MEDIOCRE';
}

export const RECRUITER_QUALITY_MULTIPLIER: Record<RecruiterQuality, number> = {
  ACE: 2.0,
  GREAT: 1.66,
  GOOD: 1.33,
  MEDIOCRE: 1.0,
};
```

`computeRecruitTeamInterest` (Sprint 35) takes a `coaches[]` arg. Update its body so each coach's contribution to interest is multiplied by `RECRUITER_QUALITY_MULTIPLIER[getRecruiterQuality(coach.ratingRecruit)]`.

**TDD approach:**
1. `tests/unit/recruiting/recruiterQuality.test.ts`:
   - Threshold tests: 85 → ACE, 84 → GREAT, 70 → GREAT, 55 → GOOD, 54 → MEDIOCRE.
   - Multiplier table values exact.

**Implementation:**
1. `shared/src/recruiting/recruiterQuality.ts` (new).
2. Sprint 35's `computeRecruitTeamInterest` updated to use it.

**Acceptance:**
- [ ] Threshold logic correct.
- [ ] Quality label exposed in IPC for the UI tag.

**Effort:** Small (~1 h).

---

### Task 36.5 — `RecruitDetailModal` extension

**What:** Surface every Sprint 35–36 mechanic in the existing modal. No new screen.

**Sections (added below existing bio/stars):**

1. **Interest Meter** (`InterestMeter.tsx` sub-component).
   - Top 5 competing teams sorted by interest desc.
   - Horizontal bars 0–100 with team name + interest value.
   - User's team highlighted.
   - For below-tier-2 scouted recruits, show "??" instead of exact values to teams the user hasn't fully scouted (your own team's interest always shown).

2. **Priorities readout.**
   - 5 small bars labeled `Playing Time`, `Proximity`, `Prestige`, `Facilities`, `NIL`.
   - Bar fill = priority weight (0–10). `wantsToLeaveHome=true` flips the Proximity bar to a "wants to leave" indicator.

3. **Pitch Reasons panel.**
   - Two cards: `Coach Pedigree`, `Coach Connection`.
   - Each card shows: active (color/icon) or inactive (grey), point value, flavor text.
   - Inactive flavor text is informational ("They're more concerned about other things") — same as FCCD.

4. **Scout Tier indicator.**
   - Three-step progress dots (Locked / Partial / Full) reflecting `RecruitInterest.scoutTier`.
   - "Run Scout (3 pts)" button gated when at Tier 2.

5. **NIL Slider.**
   - Slider from $0 to `min(50000_cents, 5 × baseline)` per recruit.
   - Live preview of points: "$120k = +18 interest".
   - "Confirm offer" button persists `RecruitInterest.nilOfferCents` and bumps `Team.nilBudgetUsedCents`.
   - Disabled when `Team.nilBudgetCents - nilBudgetUsedCents < offerCents`.

**Frontend Design Considerations:**
- Reuse modal primitives (Sprint 28 design doc layout).
- Color-blind safe: icon + label pairs, not color alone.
- Per CLAUDE.md #7 a11y — semantic form controls, AA contrast, keyboard nav.
- Dense layout — all sections fit in a single modal without scrolling on a 1080p display.

**TDD approach:**
1. `tests/unit/RecruitDetailModal.test.tsx` (extend):
   - Mounts with a fixture; all 5 new sections render.
   - Interest meter shows top-5 by interest.
   - Pitch reasons render flavor text correctly.
   - NIL slider updates preview points and disables when budget exhausted.
   - axe-clean.
2. `tests/unit/InterestMeter.test.tsx`:
   - Top 5 only; sorts desc; user's team has accent style.
3. `tests/unit/PitchReasonsCard.test.tsx`:
   - Active and inactive states render distinct visuals + correct flavor text.

**Implementation:**
1. `app/src/components/InterestMeter.tsx` (new).
2. `app/src/components/PrioritiesReadout.tsx` (new).
3. `app/src/components/PitchReasonsCard.tsx` (new).
4. `app/src/components/ScoutTierIndicator.tsx` (new).
5. `app/src/components/NilOfferSlider.tsx` (new).
6. `app/src/components/RecruitDetailModal.tsx` — extend layout to include all 5 new sub-components.
7. `app/src/store/useRecruitingStore.ts` — `setNilOffer(recruitId, cents)` action.
8. `main/src/ipc/recruitingHandlers.ts` — extend `getRecruitDetail` to include interest meter top-5, pitch reasons, recruiter quality, priority levels.
9. `app/src/styles.css` — sections.

**Acceptance:**
- [ ] Modal renders all 5 sections without overflow at 1080p.
- [ ] NIL slider edits persist on confirm.
- [ ] Pitch reasons reflect AVCA awards + coach hometownState.
- [ ] axe-core zero violations.

**Calibration risk:** None (UI only).
**Effort:** Large (~6 h — bulk of the sprint).

---

### Task 36.6 — AI heuristic update

**What:** AI teams need to (a) leverage Recruiter Quality, (b) bid NIL, (c) react to pitch reasons. Update `advanceRecruitingWeek`'s AI loop:

- For each AI team's top-10 board recruits (sorted by current interest desc):
  - Allocate one "action" per team-recruit pair.
  - Action result computed via the Sprint 35 model PLUS pitch-reason auto-application (always-on for AI, no separate UI step).
  - **NIL allocation heuristic:**
    - Compute `headroom = maxInterest - currentInterest` for each top-10 recruit.
    - Distribute `Team.nilBudgetCents` proportional to headroom × stars.
    - Trailing teams (interest < 50 vs leader) over-allocate to one "moonshot" target.

**TDD approach:**
1. `tests/integration/recruiting/aiNilAllocation.test.ts`:
   - 360 teams × full cycle. Assert: every team spends > 50% of `nilBudgetCents` by SIGNING_DAY.
2. `tests/integration/recruiting/aiPitchReasonsAutoApply.test.ts`:
   - AI team with 3 conf champs auto-applies CoachPedigree on every pitch.

**Implementation:**
1. `main/src/recruiting/aiPicks.ts` (new) — AI heuristic isolated for testability.
2. `main/src/recruiting/advanceRecruitingWeek.ts` — calls `aiPicks` for non-user teams.

**Acceptance:**
- [ ] AI teams use NIL.
- [ ] AI pitches auto-apply pitch reasons.
- [ ] Determinism: same seed → same AI choices.

**Calibration risk:** Medium.
**Effort:** Medium-Large (~4 h).

---

### Task 36.7 — Documentation + invariants

**Edits:**
1. `CLAUDE.md` "Gotchas" → Recruiting section, append:
   - "Pitch-reasons total + NIL points are bonus add-ins to `computeRecruitTeamInterest`. Combined cap = MAX_BONUS_POINTS = 150. Pitch reasons cap separately at 75 (`MAX_TOTAL_PITCH_BONUS`)."
   - "Recruiter Quality is derived per call from `Coach.ratingRecruit` thresholds [85, 70, 55, 0]. Multipliers `[2.0, 1.66, 1.33, 1.0]`. Helper: `shared/src/recruiting/recruiterQuality.ts`."
   - "Team `nilBudgetCents` refreshes at SIGNING_DAY each cycle, derived from prestige tier (`tier × $50k`, $30k floor, $300k ceiling). `nilBudgetUsedCents` tracks running spend; never persists across cycles."
   - "Pitch reason `active` flags are deterministic per `recruit.id` — different recruits respond to different pitches. No state change between sessions."
2. PRD §3.3 — note new columns and AI heuristic.
3. `docs/design/recruiting-redesign-v2.md` — update v1.2 status section.

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **36.1** (NIL schema migration) — blocks 36.3.
2. **36.4** (Recruiter Quality helper) — pure module; can run anytime.
3. **36.2** (pitch reasons) — pure module + reads existing Award rows.
4. **36.3** (NIL conversion) — uses 36.1.
5. **36.6** (AI heuristic) — needs 36.2/36.3 wired into the model.
6. **36.5** (modal UI) — bulk of the sprint; needs all backend done.
7. **36.7** (docs).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 36 status |
|---|---|---|
| `advanceRecruitingWeek` per call | < 1.5 s (Sprint 35 budget) | ⚠️ +pitch reasons + NIL adds ~3 ops per (team, recruit) — cheap, but verify. |
| `computeRecruitTeamInterest` per call | < 0.5 ms | ⚠️ pure JS arithmetic; trivial |
| `RecruitDetailModal` render | < 100 ms | ⚠️ measure with Recharts mocks |
| `getRecruitDetail` IPC | < 50 ms | ⚠️ now returns interest meter top-5 (additional query); pre-aggregate where possible |

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] Lint + typecheck + test + build green.
- [ ] `npm run test:calibration:full` unchanged.
- [ ] **Recruiting calibration check:** 5-season simulation; recruiting class distribution stays bounded. Top-prestige programs' average class stars stay ≥ 2.7 (CLAUDE.md "From Sprint 25"). League-wide commit rate ≥ 60%. Average team NIL spend at SIGNING_DAY > 50% of budget.
- [ ] Manual UAT: open a save in mid-cycle. Click any recruit → see all 5 modal sections. Adjust NIL slider, observe budget tracker decrement. Pick a recruit whose hometownState matches your HC → see CoachConnection active.
- [ ] Sprint 36 retro authored.
- [ ] Tagged `sprint-36-complete` AND `recruiting-fccd-parity-complete`.

---

## 8. Out of scope

**Out of scope per FCCD parity scope review:**
- The 4 FCCD pitch reasons (DraftSuccess, ProgramStability) — Q3 picked 2.
- Per-recruit NIL market value (FCCD has dynamic per-player baselines tied to attribute levels) — Q5 picked simplified team pool.
- Marketing level multiplier on NIL conversion — Q2 picked +1 column (academics).
- Per-coach recruiter assignment screen — Q7 picked tier-label only.
- Full split-pane recruiting screen — Q8 picked modal extension.

**Deferred to v1.3+:**
- Transfer portal as recruit-with-priorities (`PlayerRecruitmentType.Transfer`).
- Spring/Summer recruiting weeks.
- Combine measurements (FCCD reveals 40-time, bench, etc.).
- Coach skill perks (FCCD's `RecruitingPositionBonus`, `RecruitingArchetypeBonus`).
- Recruiting penalties (`OfferWithNoTarget`, `TransferWithPoorNilDeal`).
- DraftSuccess pitch reason (no NCAA → pro pipeline modeled in v1.2).
- ProgramStability pitch reason (no AD opinion model).
- Gradient scout-percent (Q4 picked 3-tier).
- Conference realignment as a recruiting factor.
- `getRecruitRubberbandMultiplier` (Sprint 35 stubbed at 1.0; v1.3 wires the real curve).
