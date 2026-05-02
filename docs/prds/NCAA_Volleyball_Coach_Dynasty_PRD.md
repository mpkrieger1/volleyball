# NCAA Volleyball Coach Dynasty — Product Requirements Document

**Version:** 0.2 (Draft)
**Owner:** Matt (solo dev)
**Target v1 release:** 2027-04 (12 months from 2026-04-18)
**Working title:** NCAA Volleyball Coach Dynasty (VCD)

\---

## 1\. Vision

A single-player career-coach dynasty simulation for NCAA Division I Women's indoor volleyball. The player takes over a program, builds a staff, recruits high-schoolers and transfers, manages NIL, and competes through conference play, conference tournaments, and a 64-team NCAA bracket — season after season. The simulation emphasizes **rally-by-rally realism**, **rotation/system tactics (5-1 vs 6-2)**, and **deep post-game analytics**. Design patterns and feature scope are inspired by *Football Coach: College Dynasty* (FCCD).

### North-star experience

1. A match feels alive: momentum swings, libero digs that keep rallies alive, rotation matchups, timeouts that actually change outcomes.
2. Building a program over 5–10 in-game seasons feels meaningful — recruiting classes, portal moves, and NIL budget decisions compound.
3. The analytics screen after each match is something a real volleyball coach would recognize.

\---

## 2\. Scope (v1)

### In scope

* **Division:** D-I Women's indoor volleyball only.
* **Teams:** All \~340 real D-I programs using real school names, logos, primary/secondary colors, and 2026 conference alignment.
* **Players:** Fully fictional (generated), editable by user.
* **Season model:** Regular season → conference tournaments → 64-team NCAA bracket (16 regional sites, 4 regions, Final Four).
* **Poll \& selection:** Weekly AVCA Top-25 poll simulation + RPI/NET-style selection metric feeding bracket committee logic.
* **Simulation:** Rally-by-rally play-by-play engine producing full box scores.
* **Roster systems:** 5-1 and 6-2 offensive systems with correct rotational consequences.
* **Positions:** OH, MB, S, OPP, L/DS (with libero tracking rules).
* **Career mode:** Coach career progression (HC/AHC/position coach), staff hiring/firing, contract negotiation, prestige.
* **Recruiting:** HS recruiting + transfer portal.
* **NIL:** NIL deals, booster collective budget, player valuation.
* **Awards (v1):** AVCA All-American teams — 1st / 2nd / 3rd / Honorable Mention.
* **Stats:** Core (K, A, D, B, SA, errors) + efficiency (hitting %, reception %, K/set, A/set, D/set).
* **Platform:** Windows desktop (primary). Mac/Linux deferred.

### Out of scope for v1

* Men's indoor, beach volleyball.
* D-II / D-III / NAIA.
* Multiplayer / online dynasties.
* Hall of Fame, coach-of-the-year trophies beyond AVCA AA teams.
* Conference realignment events (lock to 2026 alignment for v1).
* Steam release (plan a post-v1 Steam build once stable).

\---

## 3\. Technical Requirements

### 3.1 Stack

Mirrors FCCD to maximize pattern reuse:

|Layer|Choice|
|-|-|
|Shell|Electron (latest LTS)|
|UI|React + TypeScript, Vite build|
|State|Zustand (or Redux Toolkit)|
|DB|SQLite via Prisma ORM|
|Sim|Node worker threads (`volleyballSimWorker.js`, `coreWorker.js`)|
|Packaging|electron-builder (NSIS installer for Windows)|
|Charts|Recharts or Visx for analytics screens|
|Testing|Vitest (unit), Playwright (E2E for UI flows)|

### 3.2 Architecture

* **Main process:** Electron lifecycle, file I/O, save/load, DB connection.
* **Renderer:** React SPA with routed screens (Dashboard, Roster, Depth Chart, Recruiting, Portal, NIL, Schedule, Match, Stats, Staff, Settings).
* **Workers:**

  * `simWorker` — simulates a single match rally-by-rally; returns PBP log + box score.
  * `seasonWorker` — advances weeks, simulates non-user matches in parallel batches, updates polls/RPI.
  * `recruitingWorker` — nightly recruiting tick (interest decay, visits, commits).
* **IPC contract:** strictly typed (zod schemas) between renderer and workers.

### 3.3 Data model (Prisma, major entities)

```
Team        (id, schoolName, abbr, primaryColor, secondaryColor, logoPath, conferenceId, prestige)
Conference  (id, name, tier, autoBidEligible)
Coach       (id, firstName, lastName, role, teamId, contractYears, salary, ratings{recruit, develop, strategy}, careerWins)
Player      (id, teamId, firstName, lastName, position, classYear, height, jersey,
             ratings{attack, block, serve, pass, set, dig, athleticism, iq, stamina},
             potential, redshirtUsed, isLibero, isCaptain)
Recruit     (id, position, stars, ratings, interestByTeam\\\[], visits\\\[], commitTeamId?)
TransferPortal (id, playerId, reasonCode, enteredDate, newTeamId?)
NilDeal     (id, playerId, brand, amount, duration, teamRestrictionLevel)
Match       (id, homeTeamId, awayTeamId, date, week, isConference, isTournament, result{sets\\\[], winnerId}, boxScore json, pbp json)
Set         (id, matchId, index, home, away, durationSec)
PlayerMatchStat (playerId, matchId, k, e, ta, hittingPct, a, sa, se, re, d, bs, ba, rotationMinutes)
Poll        (week, rank, teamId, prevRank, firstPlaceVotes)
RPISnapshot (week, teamId, rpi, wins, losses, sos, q1Wins, q2Wins, q3Wins, q4Wins)
Season      (year, phase, userTeamId, currentWeek)
Award       (seasonYear, category, playerId, team{first|second|third|hm})
Booster     (teamId, collectiveBudget, enthusiasm)
SaveSlot    (id, name, createdAt, lastOpenedAt, dynastyYear)
```

### 3.4 Sim engine (rally-by-rally)

Each rally modeled as a finite-state machine:

```
SERVE → RECEPTION → SET → ATTACK → (DIG → SET → ATTACK)\\\* → POINT
                                              ↑ (block outcomes feed back)
```

* **Rotation state** tracked per team (which 6 are on-court, front-row vs back-row eligibility, libero replacement rules).
* **Momentum variable** (`-1.0 .. +1.0`) adjusts roll probabilities for serve quality and attack efficiency; swings on runs of 3+.
* **Timeouts \& subs** consume state: coach AI (or user) can call timeout when opponent on 3+ run; subs obey 15-per-set cap.
* **System differences:**

  * **5-1:** single setter, one OPP, stronger back-row attack when setter back-row.
  * **6-2:** two setters (back-row only sets), three attackers always front-row — penalty on setter-specific ratings but bonus on front-row attack variety.
* **Output per match:** full PBP (stringified events for UI ticker), box score, per-rotation efficiency table.

### 3.5 Performance budgets

* Single match sim: **< 150 ms** on mid-range laptop.
* Full week of \~170 matches (parallelized across workers): **< 8 s**.
* Season advance (regular season, 13 weeks): **< 2 min**.
* Save file size: **< 25 MB** after 10 in-game seasons.

### 3.6 Save / load

* Prisma SQLite DB per save slot in `%APPDATA%/VCD/saves/<slot>/game.db`.
* Multi-slot with autosave on week advance + manual save anytime.
* Forward-compatible migrations (Prisma migrations checked in).

\---

## 4\. User-facing features

### 4.1 Screens (v1)

1. **Dashboard** — week, next match, team record, top poll/RPI, inbox.
2. **Roster \& Depth Chart** — by position, redshirt toggle, libero slot, starter/6-2-second-setter toggles.
3. **Match Hub** — pre-match scout report; rally-by-rally live ticker with set-by-set scoreboard; post-match analytics.
4. **Schedule** — full season grid with results; simulate-to-next toggle.
5. **Recruiting** — HS board, interest meters, visits, calls, commits.
6. **Transfer Portal** — incoming/outgoing, tampering risk, NIL leverage.
7. **NIL** — deal marketplace, booster collective budget allocator.
8. **Staff** — HC/AHC/positional, contract negotiation.
9. **Conference / National** — standings, AVCA Top-25, RPI, bracketology preview.
10. **Awards \& History** — AVCA AA teams, records book, personal career log.
11. **Settings** — sim speed, autosave cadence, difficulty, accessibility (font size, colorblind palettes).

### 4.2 Career progression

* Coach starts as position coach, AHC, or Group-of-5 HC (user choice).
* Performance metrics roll up to prestige; prestige gates the jobs offered.
* Contract renegotiation windows after bids from other programs.

### 4.3 Analytics dashboard (differentiator)

Per match and rolling season:

* Hitting % split by rotation 1–6.
* K/set vs opponent block rating.
* Reception grade distribution (3-point / 2 / 1 / 0).
* Serve location heat map.
* Rally-length distribution; point differential by rally length bucket.

\---

## 5\. Sprint plan

> 26 two-week sprints over 12 months. Every sprint ends with a build that can be demoed and a defined exit test. A sprint is not "done" until its exit tests pass in CI and the deliverable is tagged in git.

\---

### Sprint 1 — Repo scaffold \& CI (weeks 1–2)

**Goal:** Empty-but-runnable Electron shell committed to CI.

**Deliverables**

* Monorepo layout: `/app` (renderer), `/main` (Electron main), `/workers`, `/prisma`, `/shared`.
* Electron + Vite + React + TypeScript + Zustand + Prisma + Vitest + Playwright wired together.
* GitHub Actions pipeline: install → lint (ESLint + Prettier) → typecheck → unit test → build Windows artifact.
* A placeholder "Hello, Coach" screen served from the renderer.

**Exit tests**

* `npm run build` produces a runnable Electron app on Windows.
* CI is green on a clean clone.
* Playwright smoke test launches the app and asserts the window title.

\---

### Sprint 2 — League data model \& 2026 seed (weeks 3–4)

**Goal:** A real league loads from disk into a working SQLite DB.

**Deliverables**

* Prisma schema v1 covering `Team`, `Conference`, `Player`, `Coach`, `Match`, `Season`, `SaveSlot`.
* Seed script that loads all \~340 D-I programs with correct name, abbreviation, conference, and primary/secondary colors for 2026 alignment.
* Save-slot screen: create / open / delete slot; each slot is its own DB file under `%APPDATA%/VCD/saves/<slot>/game.db`.
* Logo asset pipeline (SVG/PNG) with placeholder art where real logos aren't yet sourced.

**Exit tests**

* `prisma migrate reset \\\&\\\& npm run seed` produces a DB with exactly the expected team and conference counts.
* Creating a new save slot from the UI produces a new DB file; deleting removes it.
* Unit test verifies every team resolves to exactly one conference and has non-null colors.

\---

### Sprint 3 — Rally FSM v1 (weeks 5–6)

**Goal:** A single rally can be simulated end to end with realistic outcome distributions.

**Deliverables**

* Rally finite-state machine: `SERVE → RECEPTION → SET → ATTACK → (DIG → SET → ATTACK)\\\* → POINT`.
* Probability tables parameterized by attacker/passer/server ratings (no rotation yet — assume a flat 6-player lineup).
* Deterministic RNG with seedable runs for reproducible tests.
* Golden-fixture test harness: given seed + two lineups → expected point winner and event sequence.

**Exit tests**

* 10,000-rally Monte Carlo with balanced lineups produces side-out rates within ±3% of real NCAA averages (baseline \~65%).
* Golden-fixture tests pass deterministically across 3 consecutive runs.
* No rally exceeds 40 contacts (sanity cap).

\---

### Sprint 4 — Rotation engine \& libero rules (weeks 7–8)

**Goal:** Matches obey real volleyball rotation, substitution, and libero rules.

**Deliverables**

* Rotation state per team: 6 on-court slots with front-row / back-row tracking.
* Libero replacement: enters for back-row player on serve receive, tracks the replaced-player pairing, cannot front-row attack above net height, cannot serve (except the single-rotation exception flag).
* Substitution ledger: 15-per-set cap enforced, starters' re-entry rules honored.
* Rotation violation detector (overlap/alignment) wired into the sim for regression.

**Exit tests**

* Golden-file tests for each of the 6 rotations covering: libero swap at serve, front-row attacker eligibility, illegal back-row attack detection.
* 1,000-match regression run surfaces zero rotation violations.
* Substitution cap test: attempting a 16th sub in a set is rejected with the correct error code.

\---

### Sprint 5 — 5-1 vs 6-2, momentum, timeouts (weeks 9–10)

**Goal:** Coaches can choose an offensive system and call timeouts that measurably change outcomes.

**Deliverables**

* System toggle per team: `5-1` or `6-2` drives setter rotation and attacker availability.
* Momentum variable `\\\[-1.0, +1.0]` updated after each point; configurable swing threshold (default: 3-point run triggers momentum shift).
* Timeout model: 2 per set, \~60s narrative beat, resets opponent momentum partially.
* Coach AI v0: single baseline archetype that calls a timeout when trailing by a 3+ point run.

**Exit tests**

* A/B sim: same teams, 5-1 vs 6-2 — hitting % distributions differ measurably (≥ 0.010 gap) in the expected direction.
* Timeout effect regression: over 5,000 sets, timeouts called on 3+ runs reduce opponent scoring on the next 3 points by a statistically significant margin (p < 0.05).
* Momentum never escapes the `\\\[-1.0, +1.0]` clamp in a 10k-match fuzz run.

\---

### Sprint 6 — Box score, PBP log, single-match demo (weeks 11–12)

**Goal:** User can play one complete match end to end from a debug screen.

**Deliverables**

* Full box score schema populated per match: K, E, TA, Hit%, A, SA, SE, RE, D, BS, BA, rotation minutes.
* PBP event log as typed JSON stream, serialized into the `Match.pbp` column.
* Debug "Match Hub" screen: pick two teams, run sim, view live-ticker PBP + set scoreboard + post-match box score.
* Single-match sim meets the **< 150 ms** performance budget.

**Exit tests**

* Sum of per-player kills in the box score equals team kills in the final scoreboard (invariant).
* PBP log replayed through a pure function reproduces the final box score exactly.
* Perf test: 1,000 matches simulated back-to-back average < 150 ms each on CI hardware.
* **Demoable milestone:** user can launch app → create save → pick two teams → sim a match → view full box score and PBP.

\---

### Sprint 7 — Scheduler (weeks 13–14)

**Goal:** A full 2026 season schedule generates correctly for every D-I team.

**Deliverables**

* Scheduler produces: double round-robin conference slate + 10–12 non-conference matches per team.
* Respects travel sanity (no more than N cross-country trips per team; adjustable).
* Pre-season tournaments / invitationals (multi-match clustered weekends).
* Schedule view UI stub: team-by-team grid.

**Exit tests**

* Every team in every conference plays every other conference member exactly twice.
* Every team has between 28 and 32 total regular-season matches (NCAA cap).
* Date-conflict test: no team is scheduled for two matches on the same date.
* Regenerating the schedule with the same seed produces byte-identical results.

\---

### Sprint 8 — Parallel season worker (weeks 15–16)

**Goal:** Weeks advance fast enough to be enjoyable.

**Deliverables**

* `seasonWorker` advances one week at a time, dispatching non-user matches to a pool of `simWorker` instances across CPU cores.
* Progress reporting over IPC (week N of 13, X/170 matches complete).
* Cancellation token support (user aborts mid-advance without corrupting state).

**Exit tests**

* Full week of \~170 matches simulates in **< 8 s** on the target spec machine.
* Aborting mid-week leaves the DB in a consistent state (no partial match writes).
* Running 10 consecutive week-advances produces no memory growth > 50 MB (leak check).

\---

### Sprint 9 — AVCA Top-25 poll simulation (weeks 17–18)

**Goal:** Weekly poll reads like a real AVCA poll.

**Deliverables**

* Voter-model poll: 64 simulated voters, each with bias profiles (conference loyalty, recency weight, blue-blood preference).
* Prior-rank inertia: teams drop slowly on a bad week, rise moderately on a good week.
* First-place-vote tracking.
* Poll-history table keyed by week.

**Exit tests**

* Over a full simulated season, the end-of-year top 5 overlaps with the realistic top 5 (as defined by win % + strength of schedule) by ≥ 4 of 5.
* No team that lost its last 3 matches rises in the poll.
* No team jumps > 8 spots in a single week without a top-10 upset.

\---

### Sprint 10 — RPI / NET metric + selection logic (weeks 19–20)

**Goal:** 64-team bracket can be built algorithmically and looks defensible.

**Deliverables**

* RPI implementation (wins × 0.25 + opp win % × 0.50 + opp opp win % × 0.25, with D-I home/away weighting).
* NET-inspired alternative metric (efficiency-based).
* Selection committee module: 32 auto-bids (conference tournament winners) + 32 at-larges chosen by metric + eyeball-test rules (e.g., no sub-.500 at-larges, conference rep caps).
* A/B harness to compare RPI vs NET against historical brackets.

**Exit tests**

* Every conference tournament winner receives an auto-bid.
* Bracket has exactly 64 teams, exactly 16 seeds per region, exactly 4 regions.
* No team is seeded more than 2 lines above or below its metric rank.
* Regenerating the bracket with the same seed is deterministic.

\---

### Sprint 11 — Conference tournaments \& NCAA bracket UI (weeks 21–22)

**Goal:** Post-season is playable and visually legible.

**Deliverables**

* Conference tournament bracket generator per conference (single-elimination, seeded by regular-season standings).
* 64-team bracket UI: 4 regions, 16 regional sites, Final Four.
* User can advance tournament round-by-round, watching their own matches or simming all.
* Champion crowning screen with season-summary card.

**Exit tests**

* Full post-season completes with exactly one champion and a fully populated bracket history.
* Every tournament match outcome is preserved in `Match` rows with `isTournament = true`.
* User can view any regional bracket at any depth and navigate back without state loss.

\---

### Sprint 12 — Player generation (weeks 23–24)

**Goal:** New HS recruit classes feel realistic in talent distribution.

**Deliverables**

* HS recruit generator: stars (1–5), position archetypes (pin hitter, pure MB, rare tall OPP, libero, etc.), regional origins.
* Ratings distributions calibrated to produce a realistic talent curve (few elite, fat middle, long tail).
* Height / reach distributions aligned to position.
* Name generator with regional and ethnic diversity.

**Exit tests**

* A generated class of 1,000 recruits has a star distribution within ±5% of the target curve (e.g., \~1% 5-star, \~5% 4-star).
* Average heights by position within ±1 inch of real NCAA averages.
* No duplicate (firstName, lastName, hometown) triples in a 1,000-class batch.

\---

### Sprint 13 — Recruiting flow (weeks 25–26)

**Goal:** User can manage a recruiting board through a full cycle and land commits.

**Deliverables**

* Recruiting board UI: add/remove prospects, see interest meter, filter by position/region/stars.
* Weekly recruiting actions: calls, visits (official/unofficial), home visits — each spends points from a weekly budget.
* Interest model: prospects weigh team prestige, coach recruiting rating, location, playing-time pitch, current commits.
* Commit resolution: weighted random based on top-3 interest when a prospect decides.

**Exit tests**

* Full recruiting cycle from week 1 to signing day completes with every prospect in an end state (committed, signed elsewhere, or uncommitted).
* A top-5 program lands a recruit class that averages ≥ 3.5 stars across 10 simulated cycles.
* A bottom-quartile program's average class rating is distinguishable from a top-quartile program's (p < 0.01 over 100 sims).

\---

### Sprint 14 — Transfer portal (weeks 27–28)

**Goal:** Players enter and leave the portal, and the user can pursue incoming transfers.

**Deliverables**

* Portal entry logic: playing time, position depth, coaching change, academic fit drive portal decisions.
* Portal UI: incoming list (filterable), outgoing from your roster (with retention actions).
* Tampering risk meter (cosmetic for v1; logs events but does not trigger NCAA penalties in v1).
* NIL-leverage hook: higher NIL offers increase pursuit success rate.

**Exit tests**

* Over a simulated season, 8–15% of D-I players enter the portal (realistic range).
* A user who offers a top-quartile NIL package to a portal target wins at least 60% of head-to-head pursuits against equal-prestige peers.
* No player exists in two teams' rosters simultaneously at any simulated tick.

\---

### Sprint 15 — NIL system (weeks 29–30)

**Goal:** NIL deals and booster collective are real strategic levers.

**Deliverables**

* Booster collective per team: monthly budget, enthusiasm modifier tied to recent performance.
* NIL deal marketplace: per-player deals with brand, amount, duration, and roster restrictions.
* Player valuation engine: stars, stats, position scarcity, social reach stand-in.
* Budget allocator UI: sliders per player or "auto-distribute by value."

**Exit tests**

* Total NIL spend per team ≤ booster budget in every simulated week.
* A player with a larger NIL package has measurably lower portal-entry probability (tested over 10k simulations).
* NIL data persists correctly through save / load / quit / reopen cycles.

\---

### Sprint 16 — Offseason player development (weeks 31–32)

**Goal:** Rosters turn over and develop realistically between seasons.

**Deliverables**

* Offseason phase: seniors graduate, redshirts tick, classes advance, development rolls applied to returners.
* Development model: based on potential rating, coach development rating, playing time.
* Redshirt management UI (toggle pre-season, auto-lock after first match played).
* Roster overflow resolution (NCAA scholarship cap enforcement).

**Exit tests**

* Over 5 simulated seasons, no team exceeds the scholarship cap at any season-start tick.
* Average returner growth in `attack` rating is higher for players with >50% playing time than for benchwarmers (statistically significant).
* All graduating seniors are removed from rosters and archived to alumni history.

\---

### Sprint 17 — Coaching staff (weeks 33–34)

**Goal:** Hiring and firing assistants measurably changes team performance.

**Deliverables**

* Staff slots per team: HC, AHC, 1–2 position coaches.
* Hiring pool: pool of available coaches generated and refreshed offseason.
* Contract negotiation UI (years, salary, role).
* Role-effect wiring: recruiting rating → recruit interest, development rating → offseason growth, strategy rating → in-match coach AI.

**Exit tests**

* Teams with a top-decile recruiter in AHC slot land higher-rated classes than teams with a bottom-decile recruiter (p < 0.01 over 50 sims).
* Firing a coach mid-contract triggers a buyout deducted from the team's operating budget.
* Every team at every tick has an HC slot filled (auto-backfill on vacancy).

\---

### Sprint 18 — AVCA All-American selection (weeks 35–36)

**Goal:** Awards at season end look right to a volleyball fan.

**Deliverables**

* AA selection algorithm: 1st / 2nd / 3rd team + Honorable Mention, balanced across positions (e.g., 2 OH, 1 MB × 2 or OPP, 1 S, 1 L — final composition locked in a Sprint 18 spike).
* Stat-weighted score per player with position-specific inputs (hitting % for hitters, assists/set for setters, dig rate for liberos).
* Awards screen: season, team, position filters.
* Career awards history per player.

**Exit tests**

* Every selected AA team has the correct positional composition (validated against a rubric in test).
* Top-5 hitters by kills/set appear in at least one of the 4 teams in 90%+ of simulated seasons.
* **Demoable milestone:** a full season from preseason through bracket through awards is playable start to finish.

\---

### Sprint 19 — Match Hub polish (weeks 37–38)

**Goal:** Playing an individual match is visually engaging.

**Deliverables**

* Live PBP ticker with pacing (events stream at \~realistic pace, speed slider 1x/2x/4x/instant).
* Set-by-set scoreboard with point markers and rally-duration bars.
* Timeout and substitution banners as first-class UI events.
* Pre-match scout report: opponent tendencies (system, top hitters, recent form).

**Exit tests**

* Playwright E2E: user starts a match, sees ticker stream, sees scoreboard update per point, sees final result.
* Speed slider changes tick interval correctly at all 4 settings.
* Scout report surfaces the opponent's top-3 scorers by K/set from prior matches in the season.

\---

### Sprint 20 — Analytics dashboard (weeks 39–40)

**Goal:** Post-match and season-rolling analytics are the product's signature screen.

**Deliverables**

* Rotation-by-rotation hitting % chart (radial or heatmap).
* K/set vs opponent block rating scatter.
* Reception grade distribution (3-2-1-0) histogram per player.
* Serve location heat map (6-zone court).
* Rally-length distribution + point differential by rally bucket.

**Exit tests**

* Every chart renders from the box score and PBP log alone (no separate storage).
* All charts pass a visual-regression snapshot test.
* Chart data sums match the raw box score (cross-validated in test).

\---

### Sprint 21 — Recruiting / Portal / NIL UI polish + a11y (weeks 41–42)

**Goal:** The program-building screens are keyboard-navigable and usable at scale.

**Deliverables**

* Full keyboard navigation on recruiting board, portal list, NIL allocator.
* Sort, filter, multi-select across all three screens.
* Accessibility pass: WCAG 2.1 AA contrast, screen-reader labels, focus rings, colorblind-safe palettes.
* Font-size setting (3 options) wired globally.

**Exit tests**

* Axe-core accessibility audit reports zero violations on all three screens.
* All interactive elements reachable by keyboard alone (E2E tested).
* Every filter/sort combination on the recruiting board renders within 500 ms for a 1,000-prospect pool.

\---

### Sprint 22 — Calibration \& balance pass (weeks 43–44)

**Goal:** Simulated stats match real NCAA stats within defined tolerances.

**Deliverables**

* Benchmark CSV of real 2024–25 NCAA team and player stats checked into the repo.
* Calibration test suite that runs a full simulated season and compares to the benchmark.
* Probability-table tuning as needed to hit the tolerance bands in §8.
* Documented tuning changelog.

**Exit tests**

* Top-25 team average hitting % within ±.015 of the benchmark.
* Top-25 team average K/set within ±0.3 of the benchmark.
* Top-25 libero dig/set within ±0.4 of the benchmark.
* Calibration suite runs in CI as a nightly job.

\---

### Sprint 23 — Performance \& long-dynasty hardening (weeks 45–46)

**Goal:** The game runs well after hundreds of hours of simulated time.

**Deliverables**

* Profile every hot path: rally sim, week advance, poll calculation, RPI snapshot, save write.
* Memory-leak audit over a simulated 20-season dynasty.
* Save-file size audit; prune or compress PBP logs past year N if needed.
* Crash reporter wired in (opt-in, local log + optional upload).

**Exit tests**

* All §3.5 performance budgets met on target hardware.
* Save file after 10 seasons < 25 MB.
* Save file after 20 seasons < 60 MB.
* 20-season continuous run shows no resident-memory growth trend > 100 MB over run duration.

\---

### Sprint 24 — Release candidate build (weeks 47–48)

**Goal:** A build a beta tester could install and play without developer help.

**Deliverables**

* Signed Windows NSIS installer via electron-builder.
* Auto-update channel wired (for beta → RC → GA promotions).
* First-run experience: tutorial modal, default save slot, settings defaults.
* Telemetry opt-in with clear disclosure.

**Exit tests**

* Fresh install on a clean Windows 11 VM succeeds without prompts or errors.
* Installer < 250 MB.
* Uninstaller leaves no residual registry or `%APPDATA%` data.
* First-run completes in < 60 seconds from double-click to "Create New Save."

\---

### Sprint 25 — Closed beta \& triage (weeks 49–50)

**Goal:** Real volleyball fans play the game and we fix what breaks.

**Deliverables**

* 3-5 closed-beta agent testers created.
* Bug triage board with severity tiers.
* Hotfix channel ready to push fixes mid-beta.
* Qualitative feedback survey at end.

**Exit tests**

* Zero P0 (data-loss, crash-on-launch, unrecoverable save) bugs open at sprint end.
* ≤ 3 P1 bugs open at sprint end.
* Survey: ≥ 8/10 testers report "feels like a real volleyball match" after 5+ matches played.

\---

### Sprint 26 — v1.0 ship \& post-mortem (weeks 51–52)

**Goal:** Product is released to the public.

**Deliverables**

* v1.0 build tagged, signed, and published to itch.io (or direct download).
* Store page / landing page with screenshots, feature list, system requirements.
* README and basic user docs (installation, save location, how to report bugs).
* Post-mortem doc: what shipped, what slipped, what to do differently for v1.1.

**Exit tests**

* Public download link is live and verified from a clean machine.
* A user can complete the full loop (install → create save → play a season → win awards) on v1.0 without crashes.
* v2 backlog exists in the issue tracker with prioritization.

\---

## 6\. Code \& patterns borrowed from Football Coach: College Dynasty

FCCD is installed locally at `C:\\\\Program Files (x86)\\\\Steam\\\\steamapps\\\\common\\\\Football Coach College Dynasty\\\\`. It is a shipped, production Electron + Prisma + SQLite dynasty sim — a near-perfect structural template. The app source is packed in `resources\\\\app.asar`, but several high-value artifacts are already **unpacked on disk** and directly referenceable.

### 6.1 Directly referenceable files

|FCCD path|What it gives us|
|-|-|
|`resources\\\\prisma\\\\schema.prisma` (1,361 lines, \~60 models)|Canonical Prisma schema for a dynasty sim. Use as a **structural reference** for VCD schema — not a copy-paste target (it is football-shaped).|
|`resources\\\\prisma\\\\migrations\\\\`|Working example of Prisma migration layout for an Electron-packaged game.|
|`resources\\\\app.asar.unpacked\\\\dist\\\\main\\\\coreWorker.js`|Shape of the "core" worker (season/week advance, scheduling, stats rollups). **Study the IPC message shape and worker lifecycle; re-implement in TS.**|
|`resources\\\\app.asar.unpacked\\\\dist\\\\main\\\\footballSimWorker.js`|Shape of the per-match sim worker. Replace football-specific logic with volleyball rally FSM but **preserve the worker interface and output contract (box score + PBP log).**|
|`resources\\\\app-update.yml`|electron-builder auto-update config template.|
|`resources\\\\assets\\\\`|Asset-layout convention (logos, fonts) — reuse the folder structure only, not the assets.|
|`resources\\\\node\\\_modules\\\\`|Confirms runtime deps (Prisma client, better-sqlite3 variant, etc.) actually ship-able in an Electron NSIS build.|

### 6.2 FCCD Prisma models that map directly to VCD models

These FCCD models are structurally \~1:1 with what VCD needs; use them as the starting point (rename fields, strip football-isms, port to VCD):

* `Conference`, `Division`, `TeamDivisionYear` → VCD `Conference` + season snapshots.
* `Team`, `TeamAttributes`, `TeamStats`, `TeamStatRanks` → VCD `Team` + `TeamSeasonStats`.
* `Player`, `PlayerAttributes`, `PlayerTeamYear` → VCD `Player` + per-season records.
* `Coach`, `CoachAttributes`, `CoachTeamYear`, `CoachContract`, `CoachCareerStats`, `CoachPersonality`, `CoachAlmaMater` → VCD coach/staff subsystem (near-complete template).
* `Game`, `GameLog`, `TeamGameStats`, `GameExcitementInfo` → VCD `Match`, `Set`, PBP log, hype metric.
* `PlayerRecruitDetails`, `PlayerRecruitment`, `TeamPlayerRecruitment`, `TeamRecruitingRank` → VCD recruiting subsystem.
* `PlayerNilDeal`, `Booster` → VCD NIL + collective (drop-in structurally).
* `PlayerInjury`, `PlayerInjuryHistory` → VCD injury system (can adopt verbatim).
* `LeaguePlayerAward`, `AllLeaguePlayerAward`, `ConferencePlayerAward`, `AllConferencePlayerAward`, `LeagueCoachAward` → VCD awards (AVCA AA, conference POY, coach awards).
* `LeagueWeek` → VCD season-phase/week driver.
* `PlayerHallOfFame`, `PlayerRingOfHonor`, `PlayerStatAllTimeLeader`, `PlayerStatTeamLeader`, `TeamStatAllTimeLeader`, etc. → VCD records/history book (deferred past v1, but keep schema shape in mind for v2).
* `SchoolCoachingStaffBalance`, `TeamCustomGamePlan` → VCD staff-balance and per-team tactical presets.

### 6.3 FCCD models that do **not** port

* All football-specific stat tables (`PlayerPassingGameStats`, `PlayerRushingReceivingGameStats`, `PlayerKickingPuntingGameStats`, `PlayerOffensiveLineGameStats`, `PlayerReturningGameStats`, `PlayerDefenseGameStats` and their `\\\*YearStats` counterparts) — replace wholesale with volleyball stat tables (`PlayerMatchStat`, `PlayerSetStat`, per-rotation efficiency).
* `TeamPlayoffSeed` — football-bracket-shaped; VCD uses its own 64-team bracket model.
* `PlayerDraftDetails` — no pro volleyball draft in v1; drop.

### 6.4 Patterns (not code) to copy

* Electron main ↔ worker split with two workers (core + sim), launched from `dist/main/`.
* Prisma + SQLite per save slot, shipped inside `resources\\\\` with migrations on disk.
* `app.asar` packaging with `asar.unpacked` only for the worker JS + Prisma engine binaries (required so Node worker threads can `require()` them at runtime).
* Electron auto-update wiring via `app-update.yml`.

### 6.5 Legal / licensing note

FCCD ships under its own EULA (see `LICENSE.electron.txt` in install root, which is Electron's MIT license — not FCCD's game license). **Do not copy FCCD source, assets, strings, or the `.asar` contents into VCD.** The workflow is: *read FCCD artifacts locally as a reference to inform VCD's own clean-room TypeScript implementation.* Verify with the FCCD EULA before shipping VCD; if in doubt, treat FCCD as read-only inspiration and author every line of VCD independently.

\---

## 7\. Risks \& mitigations

|Risk|Impact|Mitigation|
|-|-|-|
|Sim calibration wrong (unrealistic hitting %)|High|Lock a "calibration benchmark" CSV from 2024–25 NCAA actuals; regression-test every sprint.|
|Scope creep into men's / beach / D-II|High|Freeze scope at v1 gate; log requests into v2 backlog.|
|Solo-dev burnout over 12 months|High|Enforce 2-week sprints with defined exit tests; ship vertical slices early.|
|Logo/color licensing pushback from schools|Medium|Ship with user-editable team assets + a toggle to use generic names; precedent from OOTP/FCCD.|
|Rotation logic bugs cascade into unfair matches|Medium|Golden-file tests for every rotation scenario (front-row attackers, libero swap at serve).|
|Electron bundle size|Low|Tree-shake, use `asar`, target <250 MB installer.|
|Copying too closely from FCCD triggers IP issues|Medium|Clean-room reimplementation only; no asset/string/source reuse (see §6.5).|

\---

## 8\. Success metrics (v1)

* **Functional:** complete 10 simulated in-game seasons without save corruption.
* **Realism:** top-25 team average hitting % within ±.015 of real NCAA averages; top-25 K/set within ±0.3.
* **Performance:** hit all §3.5 budgets on a Ryzen 5 / 16 GB machine.
* **Qualitative:** 8/10 closed-beta testers report "feels like a real volleyball match" after 5+ matches played.

\---

## 9\. Open questions (to revisit before Sprint 3)

1. RPI vs a NET-inspired metric — which gives better bracket realism? (Prototype both in Sprint 10, A/B pick.)
2. How much coach AI variety is needed in v1 (aggressive/conservative archetypes, or one baseline)?
3. NIL tax / roster cap rules — mirror current NCAA ruleset as of April 2026, or design a stable abstraction?
4. Transfer portal windows — match real calendar (post-season + spring windows) or simplify to one window for v1?
5. FCCD EULA review — confirm the "read as reference only" workflow in §6.5 is defensible before Sprint 2 schema work begins.

\---

*End of PRD v0.2*

