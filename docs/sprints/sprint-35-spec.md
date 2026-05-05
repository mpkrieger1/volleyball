# Sprint 35 Spec — FCCD-Style Recruiting Core

**Window:** weeks 69–70 (post-Sprint-34; v1.2 recruiting batch)
**Status:** Spec authored 2026-05-04 from FCCD-parity scope review (B-picks across all 8 questions). First of two sprints (35/36) overhauling recruiting to mirror Football Coach: College Dynasty.
**Augments:** Sprint 13 (recruit cycle), Sprint 21 (recruit board UI), Sprint 28 (recruiting redesign v2 doc), Sprint 33 (offseason event calendar + SIGNING_DAY).
**Personal-use note:** Continues Sprint 28 framing.

---

## 1. Why this sprint exists

VCD recruiting today is a flat interest-points model. `computeBaseInterest` runs once at board seed; weekly actions add deltas; recruits commit when their points clear a threshold. Recruits are **passive** — they have no opinion about which schools they prefer. Schools have only one stat (`prestige`) to recruit on. The user's only lever is "which buttons to click." This is the single biggest gap vs FCCD.

Sprint 35 ports FCCD's **priority-driven interest model**:

- Each recruit carries a vector of priorities (PlayingTime, ProximityToHome, Prestige, Facilities, NilDeal). Some recruits care about facilities; some don't. Some want to leave home; others want to stay close.
- Each school exposes a vector of attribute levels (prestigeLevel, facilitiesLevel, academicsLevel, …). Sprint 32 ships `facilitiesLevel`; this sprint adds `academicsLevel`.
- A recruit's interest in a school is **recomputed every tick** as the dot product of `priorities × attributeLevels`, modulated by coach integrity, coach quality, recruiting effort, and a rubberband multiplier. Pulled from FCCD module 61861 (`getRecruitTeamInterestScore`).

Sprint 35 also lands two adjacent FCCD mechanics:

- **`commitmentStatus`** (ExploringOptions → NarrowingSchools → EstablishingFavorites → WillCommitSoon → Committed) — drives UI hints about how soon a recruit decides.
- **Scout tier** — replaces today's binary SCOUT toggle with a 3-tier reveal (Locked / Partial / Full). Each SCOUT action bumps the tier by 1.

Sprint 36 adds pitch reasons + NIL + Recruiter Quality + the modal UI surfacing.

---

## 2. Sprint goal

After Sprint 35:

- Every recruit row carries a `priorities` JSON blob (5 weighted factors) and a `commitmentStatus` enum.
- Every team has a `Team.academicsLevel` column (paired with Sprint 32's `facilitiesLevel`).
- Every coach has a `hometownState` column (Sprint 36 consumes it for CoachConnection pitch reason).
- Every `RecruitInterest` row has a `scoutTier: Int` 0–2.
- The interest score helper (`computeRecruitTeamInterest`) is rewritten to compute on demand from priorities × attributeLevels. The legacy `computeBaseInterest` is removed; `computeBoardScore` (board seeding) survives as a thin wrapper that calls the new helper + adds the existing jitter for ranking stability.
- Sprint 33's RECRUITING_1/2/3 thin shells now delegate to the new model.
- SIGNING_DAY is hardened with a roster-cap check and a final commitment resolution for `WILL_COMMIT_SOON` recruits.

No UI changes this sprint — Sprint 36 ships the UI extension.

---

## 3. Inputs (must already exist)

| Input | Status | Reference |
|---|---|---|
| Sprint 32 `Team.facilitiesLevel` column | ⚠️ Sprint 32 dependency | Sprint 32 spec |
| Sprint 33 offseason event calendar + SIGNING_DAY | ⚠️ Sprint 33 dependency | Sprint 33 spec |
| `Recruit` table with `commitState`, stars, position, hometownState, hometownRegion | ✅ | `prisma/schema.prisma:197–263` |
| `RecruitInterest` table | ✅ | `prisma/schema.prisma` |
| `Coach.role` HC/AHC/AC + `Coach.ratingRecruit` | ✅ | `prisma/schema.prisma:131–151` |
| Existing recruit cycle plumbing (`openRecruitingCycle`, `advanceRecruitingWeek`, `closeRecruitingCycle`) | ✅ | `main/src/recruiting/` |
| Existing recruit generator | ✅ | `shared/src/recruiting/generator.ts` |
| `applyMigrations` save-compat path | ✅ | `main/src/saveSlots/service.ts` |

---

## 4. Tasks

### Task 35.1 — Schema migration: priorities, status, scout tier, academics, hometown

**What:** One migration adds five things at once. Migration timestamp `20261214_000000_recruiting_core`.

**Schema additions:**

```prisma
model Team {
  // ...existing fields...
  academicsLevel  Int @default(50)  // 0..100; FCCD's "academicsLevel" attribute
}

model Coach {
  // ...existing fields...
  hometownState  String?  // 2-letter code; null for legacy rows until backfill
}

model Recruit {
  // ...existing fields...
  prioritiesJson      String?  // JSON {playingTime, proximityToHome, prestige, facilities, nilDeal}
  wantsToLeaveHome    Boolean  @default(false)
  commitmentStatus    String   @default("EXPLORING")
                              // 'EXPLORING' | 'NARROWING' | 'FAVORITES'
                              // | 'WILL_COMMIT_SOON' | 'COMMITTED'
}

model RecruitInterest {
  // ...existing fields...
  scoutTier  Int @default(0)  // 0=Locked, 1=Partial, 2=Full
}
```

`prioritiesJson` is `String?` so legacy rows don't fail the migration; the backfill (Task 35.3) populates it. Same pattern as Sprint 32's potential backfill.

**TDD approach:**
1. `tests/integration/migrations/recruitingCoreMigration.test.ts`:
   - Apply on a fresh DB; assert all 5 columns exist with correct defaults.
   - Apply on a legacy DB (existing Recruit + RecruitInterest + Coach + Team rows); assert no FK violations; assert defaults applied.
   - Idempotent re-apply.

**Implementation:**
1. `prisma/migrations/20261214_000000_recruiting_core/migration.sql`.
2. `prisma/schema.prisma` — additions above. Run `prisma generate`.

**Acceptance:**
- [ ] Migration applies cleanly on fresh + legacy DBs.
- [ ] `applyMigrations` re-application is idempotent.

**Calibration risk:** None.
**Schema risk:** Medium — five additions across four tables. Forward-compat verified by Sprint 25 tracking pattern.
**Effort:** Small (~1.5 h).

---

### Task 35.2 — Pure helpers: priorities + interest model

**What:** Three pure functions in `shared/src/recruiting/priorityModel.ts`.

```ts
export type RecruitPriorityKey =
  | 'playingTime'
  | 'proximityToHome'
  | 'prestige'
  | 'facilities'
  | 'nilDeal';

export interface RecruitPriorities {
  playingTime: number;       // 0..10; higher = recruit cares more
  proximityToHome: number;
  prestige: number;
  facilities: number;
  nilDeal: number;
}

export interface TeamAttributeLevels {
  prestigeLevel: number;     // existing Team.prestige normalized to 0..100
  facilitiesLevel: number;   // 1..10 from Sprint 32
  academicsLevel: number;    // 0..100 from Task 35.1 (kept available for v1.3 use)
  playingTimeLevel: number;  // 0..100; computed from roster outlook
}

// FCCD module 1392 port — what level does this team show this recruit?
export function derivePriorityLevels(
  recruit: Recruit, team: TeamAttributeLevels & { region: string }
): Record<RecruitPriorityKey, number>;

// FCCD module 61861 port — interest score in [0, 100].
export function computeRecruitTeamInterest(args: {
  recruit: Recruit;
  team: TeamAttributeLevels & { region: string };
  priorities: RecruitPriorities;
  coachIntegrity: number;     // 0..100 from team's HC; defaults to 50 in v1.2
  coaches: { role: string; ratingRecruit: number }[];
  rubberbandMultiplier: number;  // 1.0 by default; Sprint 36 supplies real
}): number;

// Sample priorities for a generated recruit. Box–Muller on each component
// with mean=5, sd=2; clipped to [0,10]. Generates `wantsToLeaveHome` as
// a 15% chance flag that flips proximity weight semantics.
export function sampleRecruitPriorities(rng: SeededRng): {
  priorities: RecruitPriorities;
  wantsToLeaveHome: boolean;
};
```

**Interest formula** (port of FCCD `getRecruitTeamInterestScore`):

```
total = 0; weight = 0
for each priority p in {playingTime, proximityToHome, prestige, facilities}:
  weight += p.priority * p.weight  // weight from the priority sort order: prestige=4, playingTime=3, proximity=2, facilities=1
  total += p.level * p.priority * p.weight
if total > 0:
  raw = (total / weight) * (coachIntegrity / 100)
else:
  raw = 0

// nilDeal handled separately — ignored in this sprint (Sprint 36 wires it in)

return clamp(round(raw), 0, 100)
```

**TDD approach:**
1. `tests/unit/recruiting/priorityModel.test.ts`:
   - `derivePriorityLevels`: spot-check each priority returns expected level for a given (recruit, team).
   - `computeRecruitTeamInterest`: identical priorities → higher score for higher-attribute team. Recruit who weights `prestige=10, facilities=0` cares 100% about prestige; flipping the recruit's priorities to `prestige=0, facilities=10` flips which team scores higher.
   - `sampleRecruitPriorities`: 10K samples → mean ≈ 5, sd ≈ 2 per component; ~15% of samples have `wantsToLeaveHome=true`.
   - Determinism: same seed → same priorities.
2. `tests/unit/recruiting/interestRecompute.test.ts`:
   - Bumping a team's `academicsLevel` does NOT change a recruit's interest in v1.2 (we don't surface academics priority by default — but the column is reserved). Bumping `facilitiesLevel` for a recruit who weights facilities highly DOES change interest.

**Implementation:**
1. `shared/src/recruiting/priorityModel.ts` (new).
2. Re-export via `@vcd/shared/recruiting` namespace.
3. `shared/src/recruiting/playingTimeLevel.ts` (new) — small helper computing `playingTimeLevel` from a team's roster outlook (count of returning starters at the recruit's position vs cap; FCCD uses a similar `getMaxYoungPlayersByPosition` cap concept).

**Acceptance:**
- [ ] All unit tests pass.
- [ ] Pure functions; no IO.

**Calibration risk:** Medium — this becomes the core of the recruiting math.
**Schema risk:** None.
**Effort:** Medium (~3 h).

---

### Task 35.3 — Backfill priorities for existing recruits + seed academics

**What:** Two post-migration backfills:

1. **Recruit priorities backfill.** For every Recruit row with `prioritiesJson` null, generate priorities deterministically from `recruit.id` (so a save-reload produces the same values). Set `wantsToLeaveHome` from the same RNG. Idempotent — skip rows that already have priorities.
2. **`Team.academicsLevel` backfill.** Hand-authored CSV at `prisma/seedData/teamAcademics.csv` with ~30 academic-elite programs (Stanford 95, Northwestern 90, Duke 90, Vanderbilt 88, BYU 85, Notre Dame 85, Princeton 95, etc.); rest default to 50. Apply during `seedLeagueInto` AND post-migration (for legacy saves). Mirrors the Sprint 32 facilities-tier pattern.
3. **`Coach.hometownState` backfill.** Generate a hometown state per coach using the existing region distribution (HCs from prestige-rich states slightly more likely to be from the same region as their team). Deterministic from `coach.id`.

**TDD approach:**
1. `tests/integration/migrations/recruitingCoreBackfill.test.ts`:
   - Legacy save with 3000 recruits → `applyMigrations` populates priorities for all of them; each priority ∈ [0, 10]; `wantsToLeaveHome` true for ~15%.
   - Re-running the open path doesn't re-generate (idempotent).
2. `tests/integration/seed/teamAcademicsSeed.test.ts`:
   - Stanford (or whatever id) has academicsLevel ≥ 90; a random low-prestige team has 50.
3. `tests/integration/seed/coachHometownSeed.test.ts`:
   - Every coach has a non-null hometownState after seed.

**Implementation:**
1. `main/src/saveSlots/backfillRecruitingCore.ts` (new) — single migration-keyed step calling three sub-functions.
2. `prisma/seedData/teamAcademics.csv` (new).
3. `shared/src/seed/teamAcademicsLoader.ts` (new) — reads + parses the CSV.
4. `shared/src/recruiting/priorityModel.ts` exports `priorityFromId(id)` for deterministic per-recruit generation.
5. `shared/src/seed/leagueSeed.ts` — write `Team.academicsLevel` + `Coach.hometownState` during `seedLeagueInto`.

**Acceptance:**
- [ ] Legacy saves: every Recruit has priorities; every Team has academicsLevel; every Coach has hometownState.
- [ ] Idempotent.
- [ ] Backfill < 5 s for 3000 recruits + 360 teams + ~1100 coaches.

**Calibration risk:** Low.
**Schema risk:** None (uses Task 35.1 columns).
**Effort:** Medium (~3 h — 3 backfill paths).

---

### Task 35.4 — Wire interest model into recruit cycle

**What:** Replace `computeBaseInterest` consumption in three places:

1. **`openRecruitingCycle`** — board seeding. Currently calls `computeBoardScore` which calls `computeBaseInterest`. Rewrite `computeBoardScore` to call `computeRecruitTeamInterest` (Task 35.2) + the existing 25-pt stars bonus + the deterministic jitter. Result is still a board ranking, just sourced from priorities × levels instead of prestige × stars.
2. **`advanceRecruitingWeek`** — interest math during the cycle. Today the AI applies a hard-coded `120 × (coachRating/100) × (prestige/60)` delta. Rewrite to:
   - For each (team, recruit) board pair, RECOMPUTE interest from priorities × levels.
   - Apply per-action point deltas ONLY to the persisted RecruitInterest.points field for incremental "earned" credit. The recruit's resolved interest at decision time is `recompute(priorities, levels) + persistedPoints`.
   - This matches FCCD: the dot-product is the floor, the points the user accumulates are the bonus.
3. **`closeRecruitingCycle`** / SIGNING_DAY — final commit resolution. Today `pickCommittingTeam` weights by `interest^5`. Keep the formula but feed it the recomputed interest (priorities × levels + earned points).

**Roster-cap check at SIGNING_DAY:** Before a recruit commits, verify the destination team isn't over the soft roster cap (`SCHOLARSHIP_LIMIT = 17` for v1.2 D-I volleyball — derived from realistic NCAA roster sizes; FCCD uses 85 for football). If full, the recruit goes UNCOMMITTED instead of COMMITTED.

**TDD approach:**
1. `tests/integration/recruiting/interestRecomputed.test.ts`:
   - Open cycle with a 4★ OH; her board has 30 teams. Bump one team's `facilitiesLevel` from 3 to 9. Re-rank her board. The bumped team should rise (only if she weights facilities).
2. `tests/integration/recruiting/cycleEndToEnd.test.ts`:
   - Open → advance 12 weeks → close. Assert: > 60% of recruits commit (existing invariant); commits respect roster cap (no team has > 17 incoming + returning by position).
3. `tests/integration/recruiting/scholarshipCap.test.ts`:
   - Saturate a team's roster at 16. Add 5 recruits committing to them. Assert: 1 commits, 4 go UNCOMMITTED.
4. `tests/integration/recruiting/legacySaveCompat.test.ts`:
   - Open a save mid-cycle (legacy `commitState` rows with no priorities). Backfill runs. Cycle continues without error.

**Implementation:**
1. `shared/src/recruiting/interestModel.ts` — replace `computeBaseInterest` body with a call to `computeRecruitTeamInterest`; remove the file once all callers are migrated. Keep `computeBoardScore` as the wrapper.
2. `main/src/recruiting/advanceRecruitingWeek.ts` — pre-load each team's `attributeLevels`, recruits' `priorities`, and coaches in one batch (CLAUDE.md "From Sprint 13" N+1 lesson). Loop over (team, recruit) pairs computing interest in JS.
3. `main/src/recruiting/closeRecruitingCycle.ts` — feed `pickCommittingTeam` the recomputed interest; add the roster-cap check before each commit.
4. Drop the legacy hard-coded AI delta formula in favor of an action-result model that returns `{pointsToAdd, scoutTierAdvance}` per action (preparing for Sprint 36).

**Acceptance:**
- [ ] Board seeding uses the new model.
- [ ] Weekly advance uses the new model.
- [ ] Commit resolution uses the new model.
- [ ] Roster-cap check active at SIGNING_DAY.
- [ ] No regression in the existing "60% commit rate" exit test.

**Calibration risk:** **High**. The full model is now in flight. Run a 5-season simulation as part of the exit checklist; assert top-program recruiting class score average remains ~1 star above league mean (existing Sprint 13 invariant, recently widened to ≥ 2.7 stars per CLAUDE.md).
**Schema risk:** Low.
**Effort:** Large (~5 h — touches 3 service entry points + the AI loop).

---

### Task 35.5 — `commitmentStatus` state machine

**What:** Pure helper computing a recruit's status from their interest distribution + cycle week.

```ts
export function deriveCommitmentStatus(args: {
  topThreeInterest: number[];   // sorted desc
  weekInCycle: number;          // 1..12
  stars: number;
}): 'EXPLORING' | 'NARROWING' | 'FAVORITES' | 'WILL_COMMIT_SOON' | 'COMMITTED';
```

Mapping (port-adapted from FCCD `RecruitCommitmentStatus`):

- `COMMITTED` — `commitState === 'COMMITTED'` (delegates).
- `WILL_COMMIT_SOON` — top interest ≥ 80 AND lead over #2 ≥ 15.
- `FAVORITES` — top-3 interest all ≥ 60.
- `NARROWING` — top-3 interest all ≥ 40.
- `EXPLORING` — otherwise.

Persisted in `Recruit.commitmentStatus`. Recomputed at the end of each `advanceRecruitingWeek` call.

**TDD approach:**
1. `tests/unit/recruiting/commitmentStatus.test.ts`:
   - Each transition reachable; idempotent ordering (FAVORITES → WILL_COMMIT_SOON only; never sideways drift).

**Implementation:**
1. `shared/src/recruiting/commitmentStatus.ts` (new).
2. `main/src/recruiting/advanceRecruitingWeek.ts` — call at end of each tick; persist via batched array `$transaction`.

**Acceptance:**
- [ ] All 4 transitions covered by unit tests.
- [ ] No status downgrades except via `commitState` transitions.

**Effort:** Small-Medium (~2 h).

---

### Task 35.6 — Scout tier mechanic

**What:** Replace today's binary SCOUT toggle with a 3-tier reveal.

- Tier 0 (Locked): position + stars + height + hometown only.
- Tier 1 (Partial): + best 3 of 9 ratings + potential range (50-pt window).
- Tier 2 (Full): + all 9 ratings + potential exact value.

A SCOUT action advances `RecruitInterest.scoutTier` by 1 (max 2). Cost stays at 3 points.

The renderer reveal logic lives in the IPC layer — `recruiting.getRecruitDetail` returns a stripped payload based on `scoutTier`. Sprint 36's modal extension wires the UI.

**TDD approach:**
1. `tests/unit/recruiting/scoutTierReveal.test.ts`:
   - Tier 0 payload omits ratings + potential.
   - Tier 1 payload includes top 3 ratings + potential range.
   - Tier 2 payload includes all 9 ratings + exact potential.
2. `tests/integration/recruiting/scoutAdvance.test.ts`:
   - 3 SCOUT actions in sequence advance tier 0 → 1 → 2 → 2 (capped).

**Implementation:**
1. `main/src/recruiting/scoutReveal.ts` (new) — pure-ish projection of recruit fields to the IPC response.
2. `main/src/ipc/recruitingHandlers.ts` — adopt `scoutReveal` in the detail handler.
3. `shared/src/recruiting/actions.ts` — SCOUT action result is now `{scoutTierAdvance: 1, pointsToAdd: 0}`.

**Acceptance:**
- [ ] Three reveal tiers behave correctly.
- [ ] Existing tests that assumed binary reveal are updated.

**Effort:** Medium (~2.5 h).

---

### Task 35.7 — Documentation + invariants

**Edits:**
1. `CLAUDE.md` "Gotchas" → Recruiting section (or new subsection): add invariants:
   - "Recruit interest is computed on demand from `priorities × team.attributeLevels`, not patched delta-by-delta. The persisted `RecruitInterest.points` field is the cumulative bonus from weekly actions; resolved interest at decision time = `computeRecruitTeamInterest(...) + persistedPoints`."
   - "Recruit priorities are deterministic per `recruit.id` — backfill regenerates legacy rows from the id hash."
   - "Scout tier 0/1/2 governs what fields the IPC handler reveals to the renderer; renderer must NOT assume all rating fields are present."
   - "SIGNING_DAY enforces the soft scholarship cap (`SCHOLARSHIP_LIMIT = 17` per team for v1.2 D-I volleyball). Over-cap commits become UNCOMMITTED."
2. PRD §3.3 (data model) — note the new columns.
3. `docs/design/recruiting-redesign-v2.md` — append a "v1.2 status" section listing what's live as of Sprint 35 (model + scout tier + SIGNING_DAY hardening) vs deferred to Sprint 36 (UI surfacing).

**Effort:** Small (~30 min).

---

## 5. Order of execution

1. **35.1** (schema migration) — blocks everything.
2. **35.2** (priority + interest helpers) — pure module; can run in parallel with 35.3.
3. **35.3** (backfills + academics seed + coach hometown seed).
4. **35.4** (wire into cycle) — heaviest backend.
5. **35.5** (commitmentStatus state machine).
6. **35.6** (scout tier).
7. **35.7** (docs).

---

## 6. Performance budget watch

| Surface | Budget | Sprint 35 status |
|---|---|---|
| `openRecruitingCycle` (3000 recruits, ~360 teams) | < 8 s | ⚠️ board scoring now does priorities × levels per pair = ~1M ops; pre-fetch levels + priorities in 2 queries |
| `advanceRecruitingWeek` (per call, 360 teams) | < 1.5 s | ⚠️ interest recompute over each team's top-30; ~10K dot products. Profile during impl. |
| `closeRecruitingCycle` (commit resolution) | < 3 s | ⚠️ unchanged from Sprint 13 except adds roster-cap check |
| Save-file size | unchanged-ish | ⚠️ +1 JSON column on Recruit (~100 bytes × 3000 = 300 KB/season, transient) |

---

## 7. Exit criteria

- [ ] All 7 tasks' acceptance checkboxes ticked.
- [ ] Lint + typecheck + test + build green.
- [ ] `npm run test:calibration:full` unchanged (sim path untouched).
- [ ] **Recruiting calibration check:** 5-season simulation; top-prestige programs' average recruiting class stars stay ≥ 2.7 (CLAUDE.md "From Sprint 25"). League-wide commit rate ≥ 60%. No team exceeds the scholarship cap.
- [ ] Manual UAT: open a save mid-cycle, verify priorities present on every recruit, advance a week, observe board re-rankings reflect priorities (e.g. a high-academics-priority recruit's board shifts toward Stanford-tier teams).
- [ ] Sprint 35 retro authored.
- [ ] Tagged `sprint-35-complete`.

---

## 8. Out of scope (Sprint 36)

- **Pitch reasons** (CoachPedigree, CoachConnection) — Sprint 36.
- **NIL pool + per-recruit NIL offers** — Sprint 36.
- **Recruiter Quality tier label** — Sprint 36.
- **`RecruitDetailModal` UI extension** (interest meter, priorities readout, pitch reasons, scout tier indicator, NIL slider) — Sprint 36.
- **AI heuristic update** to leverage new model — Sprint 36 (pairs with Quality tier work).

**Out of scope per FCCD parity scope review:**
- The 4 additional FCCD priorities (StadiumAtmosphere, CollegeLife, Academics-as-priority, SchemeFit) — Q1 picked the slim 5-priority set.
- The full FCCD attribute-levels set (StadiumLevel, CollegeLifeLevel, MarketingLevel, etc.) — Q2 picked +1 column (academics).
- Per-coach recruiter assignment UI (FCCD's `RecruiterFocus.Recruiting` vs `Scouting`) — Q7 picked tier-label only.
- The 4 FCCD pitch reasons in full — Q3 picked 2 (CoachPedigree, CoachConnection); shipping in Sprint 36.

**Out of scope (deferred to v1.3+):**
- Transfer portal as recruit-with-priorities (FCCD's `PlayerRecruitmentType.Transfer`).
- Spring/Summer recruiting weeks.
- `getRecruitRubberbandMultiplier` — Sprint 36 supplies a constant 1.0 in the helper signature; v1.3 wires the real catch-up curve.
- Recruiting penalty types (`OfferWithNoTarget`, `TransferWithPoorNilDeal`).
- Combine measurements / scout-percent gradient (Q4 picked 3-tier discrete; FCCD's percent gradient is v1.3+).
