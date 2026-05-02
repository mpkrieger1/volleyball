# VCD Closed Beta — End-of-Sprint Survey

**Sprint 25 PRD exit test:** ≥ 8/10 testers answer ≥ 8 to Q1 ("feels like a real volleyball match") after 5+ matches played.

## Delivery

Create a Google Form (or equivalent) that mirrors the questions below, send the link to all beta testers in the final week of Sprint 25, give a 1-week response window. Aggregate responses into `docs/release/beta-survey-results-<date>.md` (a flat append to that file is fine — no PII other than tester handle which is opt-in).

The questions are designed to take ≤ 5 minutes total.

---

## Questions

### Q1 (PRD-critical) — Realism

After 5+ matches played, does VCD feel like a real volleyball match? **(1–10, where 10 = "indistinguishable from watching D-I D1 women's volleyball")**

> _Free-text follow-up:_ what was the most/least realistic thing you noticed?

### Q2 — Pacing

How does the moment-to-moment pacing feel? **(1–10)**

- 1 = "way too fast, I miss what's happening"
- 5 = "fine but predictable"
- 10 = "tight, every rally has stakes"

### Q3 — Recruiting depth

Did recruiting feel like a meaningful subsystem with strategy or like a forced grind? **(1–10)**

> _Free-text:_ which recruiting action did you use most?

### Q4 — Postseason drama

Did the conference tournament + NCAA bracket feel like a payoff to the regular season? **(1–10)**

### Q5 — UI clarity

Could you find what you needed without reading docs? **(1–10)**

> _Free-text:_ which screen confused you most?

### Q6 — Performance

Any sluggishness, frame stutters, slow week-advances, or memory growth over a long session? **(1–10, 10 = "felt instant throughout")**

### Q7 — Crashes encountered

How many crashes / freezes / unrecoverable saves did you hit during the beta? **(0 / 1 / 2 / 3+ / "I lost count")**

> _Free-text:_ briefly describe each (or link the issues you filed).

### Q8 — Save reliability

Did your saves load reliably across launches? **(yes / mostly / occasionally lost progress / never worked right)**

### Q9 — Would you recommend?

Would you recommend VCD to another volleyball or dynasty-sim fan today? **(yes / yes-with-caveats / not yet / no)**

> _Free-text:_ what's the biggest thing that's holding it back?

### Q10 — Open feedback

Anything else you want the maintainer to hear — feature requests, frustrations, things you loved? **(free-text)**

---

## Optional demographic / context

- Familiarity with volleyball: never watched / casual fan / serious fan / played the sport / coached the sport.
- Familiarity with dynasty sims: none / casual / heavy.
- Hours played during Sprint 25 beta: _____.

These help interpret the scores — a "casual sim, never watched volleyball" tester scoring Q1 at 7 is different from a "coached the sport, heavy sim" tester scoring it at 7.

---

## Aggregating results

In `docs/release/beta-survey-results-<date>.md`:

- Mean + median for each numeric question.
- Distribution histogram (text bars) for Q7 crash count.
- Verbatim free-text grouped by question.
- A summary at the top: did we hit the PRD bar? (Q1 mean ≥ 8?)

Bring the results to the Sprint 25 retrospective + Sprint 26 planning. If Q1 mean < 8, that's a Sprint 26 ship blocker — defer ship until follow-up tuning lands.
